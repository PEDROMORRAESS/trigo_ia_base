import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

import {
  SessionContext,
  ConversationMessage,
  WTSWebhookPayload,
  WTSMessage,
} from '../types';
import { redisService } from '../services/redis.service';
import { wtsService } from '../services/wts.service';
import { openaiService } from '../services/openai.service';
import { buscarProduto } from '../functions/buscar-produto';
import { buscarEmpresa } from '../functions/buscar-empresa';
import { enviarMidia } from '../functions/enviar-midia';
import { enviarCatalogo } from '../functions/enviar-catalogo';
import { transferirConsultor } from '../functions/transferir-consultor';
import { encerrarAtendimento } from '../functions/encerrar-atendimento';
import { splitIntoSegments } from '../utils/message-formatter';
import { MESSAGE_DELAY_MS, MAX_SEGMENTS, SUMMARY_THRESHOLD, SUMMARY_KEEP_RECENT, CONFIG } from '../config/constants';
import { logger } from '../utils/logger';
import { telegramService } from '../services/telegram.service';

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_PATH = path.resolve(process.cwd(), 'SMART-TRIGO-SYSTEM-PROMPT.txt');
let _systemPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!_systemPrompt) {
    _systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
  }
  return _systemPrompt;
}

setInterval(() => { _systemPrompt = null; }, 60 * 60 * 1000);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_produto',
      description: 'Busca produtos no catálogo da Trigo Móveis por nome, categoria, ambiente ou características. Use sempre antes de informar opções ao cliente.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termo de busca. Ex: "sofá sala 3 lugares", "mesa jantar madeira", "cadeira escritório"',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_midia_produto',
      description: 'Envia imagem ou vídeo de um produto ao cliente. Use quando o produto tiver image_url_1/2/3 ou video_url disponível.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL da imagem ou vídeo do produto (use image_url_1, image_url_2, image_url_3 ou video_url)' },
          tipo: { type: 'string', enum: ['imagem', 'video'], description: 'Tipo de mídia a enviar' },
          caption: { type: 'string', description: 'Legenda curta com nome e descrição breve do produto' },
        },
        required: ['url', 'tipo', 'caption'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_catalogo',
      description: 'Envia o catálogo PDF da loja ao cliente. Use quando o cliente solicitar catálogo, portfólio ou quiser ver mais opções.',
      parameters: {
        type: 'object',
        properties: {
          categoria: {
            type: 'string',
            description: 'Categoria de interesse do cliente. Ex: "sofa", "cama". Deixe vazio para enviar catálogo geral.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_informacao_empresa',
      description: 'Busca informações sobre a Trigo Móveis: horários, garantia, entrega, missão, diferenciais. Use quando o cliente perguntar sobre a empresa.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'O que o cliente quer saber. Ex: "horário de funcionamento", "garantia", "entrega"' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transferir_para_consultor',
      description: 'Transfere o atendimento para um consultor humano. Use imediatamente quando o cliente mencionar: preço, orçamento, parcelamento, desconto, frete, prazo, montagem, querer comprar/fechar, pedir foto de ambiente/projeto/composição, enviar arquivo, ficar impaciente, ou quando a base de conhecimento não cobrir a dúvida.',
      parameters: {
        type: 'object',
        properties: {
          motivo: {
            type: 'string',
            description: 'Motivo da transferência. Ex: "cliente perguntou sobre preço", "cliente quer fechar compra", "cliente enviou imagem de ambiente"',
          },
        },
        required: ['motivo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'encerrar_atendimento',
      description: 'Encerra o atendimento quando o cliente sinalizou que terminou (ok, obrigado, era isso, até logo) ou ficou inativo após orientação completa.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ─── Context Summarization ────────────────────────────────────────────────────

async function maybeCompressHistory(session: SessionContext): Promise<void> {
  const history = session.conversationHistory;
  if (history.length <= SUMMARY_THRESHOLD) return;

  const toSummarize = history.slice(0, -SUMMARY_KEEP_RECENT);
  const recent = history.slice(-SUMMARY_KEEP_RECENT);

  try {
    const summary = await openaiService.summarizeHistory(toSummarize);
    session.conversationHistory = [
      {
        role: 'user',
        content: `[RESUMO DO ATENDIMENTO ANTERIOR]:\n${summary}`,
      },
      {
        role: 'assistant',
        content: 'Entendido. Continuando o atendimento com base no histórico.',
      },
      ...recent,
    ];
  } catch (err) {
    logger.error('Failed to summarize history', err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendSegmented(telefone: string, text: string): Promise<void> {
  const segments = splitIntoSegments(text).slice(0, MAX_SEGMENTS);
  for (let i = 0; i < segments.length; i++) {
    if (i > 0) await delay(MESSAGE_DELAY_MS);
    await wtsService.sendMessage(telefone, segments[i]);
  }
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: SessionContext
): Promise<string> {
  logger.info(`Tool call: ${toolName}`, { args });

  switch (toolName) {
    case 'buscar_produto':
      return JSON.stringify(await buscarProduto(args.query as string));

    case 'enviar_midia_produto': {
      const tipo = args.tipo as string;
      const url = args.url as string;
      const caption = args.caption as string;
      if (tipo === 'video') {
        await wtsService.sendVideo(context.telefone, url, caption);
        return 'success: vídeo enviado';
      }
      return await enviarMidia(url, caption, context);
    }

    case 'enviar_catalogo':
      return await enviarCatalogo(args.categoria as string | undefined, context);

    case 'buscar_informacao_empresa':
      return JSON.stringify(await buscarEmpresa(args.query as string));

    case 'transferir_para_consultor': {
      const result = await transferirConsultor(args.motivo as string, context);
      if (!result.startsWith('erro:')) {
        context.transferred = true;
      }
      return result;
    }

    case 'encerrar_atendimento': {
      const result = await encerrarAtendimento(context);
      if (!result.startsWith('erro:')) {
        context.encerrado = true;
      }
      return result;
    }

    default:
      return `erro: função desconhecida "${toolName}"`;
  }
}

async function resolveMessageText(msg: WTSMessage): Promise<string | null> {
  if (msg.type === 'TEXT' && msg.text) return msg.text;

  const fileUrl =
    msg.details?.file?.publicUrl ||
    (msg.file as { publicUrl?: string } | null | undefined)?.publicUrl;

  if (msg.type === 'AUDIO' && fileUrl)
    return `[Áudio do cliente]: ${await openaiService.transcribeAudio(fileUrl)}`;

  if (msg.type === 'IMAGE' && fileUrl)
    return `[Cliente enviou uma imagem]: ${await openaiService.analyzeImage(fileUrl)}`;

  if (msg.type === 'DOCUMENT')
    return `[Cliente enviou um documento/arquivo]`;

  if (msg.type === 'VIDEO')
    return `[Cliente enviou um vídeo]`;

  return null;
}

// ─── Main Agent Entry Point ───────────────────────────────────────────────────

export async function processWithSmartTrigo(
  payload: WTSWebhookPayload,
  messages: WTSMessage[]
): Promise<void> {
  const { sessionId, contact } = payload;
  const telefone = contact.phonenumber.replace(/\D/g, '');

  try {
    let session = await redisService.getSession(sessionId);
    const isFirstContact = !session;
    if (!session) {
      session = {
        sessionId,
        contactId: contact.id,
        telefone,
        nome: contact.name || undefined,
        conversationHistory: [],
        lastActivity: Date.now(),
      };
    }

    // Envia vídeo institucional no primeiro contato
    if (isFirstContact && CONFIG.TRIGO_INTRO_VIDEO_URL) {
      try {
        await wtsService.sendVideo(telefone, CONFIG.TRIGO_INTRO_VIDEO_URL);
        logger.info('Intro video sent', { sessionId });
      } catch (err) {
        logger.error('Failed to send intro video', err);
      }
    }

    // Stay silent after transfer or closing
    if (session.transferred || session.encerrado) {
      logger.info('Session already transferred/closed — ignoring', { sessionId });
      return;
    }

    // Resolve all message contents
    const texts: string[] = [];
    for (const msg of messages) {
      const text = await resolveMessageText(msg);
      if (text) texts.push(text);
    }

    if (texts.length === 0) {
      logger.warn('No processable content', { sessionId });
      return;
    }

    await maybeCompressHistory(session);

    // Build user message with context
    const contextBlock = [
      `[CONTEXTO]:`,
      `- sessionId: ${sessionId}`,
      `- Nome: ${session.nome || 'não coletado'}`,
      `- Telefone: ${telefone}`,
      `- Ambiente de interesse: ${session.ambiente || 'não identificado'}`,
      `- Produto de interesse: ${session.produtoInteresse || 'não identificado'}`,
      ``,
      `Se o cliente já forneceu informações, NÃO repita perguntas.`,
    ].join('\n');

    session.conversationHistory.push({
      role: 'user',
      content: `[MENSAGEM DO CLIENTE]: ${texts.join('\n')}\n\n${contextBlock}`,
    });

    // ─── Agent loop ────────────────────────────────────────────────────────────

    const MAX_ITERATIONS = 15;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const aiMessage = await openaiService.runAgent(
        getSystemPrompt(),
        session.conversationHistory,
        TOOLS
      );

      const toolNames = aiMessage.tool_calls?.map((tc) => tc.function.name) ?? [];
      logger.info(`Agent loop iteration ${i}`, {
        sessionId,
        hasContent: !!aiMessage.content?.trim(),
        toolCalls: toolNames,
      });

      session.conversationHistory.push({
        role: 'assistant',
        content: aiMessage.content,
        tool_calls: aiMessage.tool_calls?.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      } as ConversationMessage);

      // No tool calls = final text response
      if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
        if (aiMessage.content?.trim()) {
          await sendSegmented(telefone, aiMessage.content);
        } else {
          logger.warn('Agent returned no content and no tool calls', { sessionId, iteration: i });
        }
        break;
      }

      // Execute each tool call
      for (const tc of aiMessage.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          logger.error('Failed to parse tool arguments', tc.function.arguments);
        }

        const toolResult = await executeTool(tc.function.name, args, session);

        session.conversationHistory.push({
          role: 'tool',
          content: toolResult,
          tool_call_id: tc.id,
        });
      }

      // After transfer: one final message then stop
      if (session.transferred) {
        const finalMessage = await openaiService.runAgent(
          getSystemPrompt(),
          session.conversationHistory,
          TOOLS
        );
        if (finalMessage.content?.trim() && !finalMessage.tool_calls?.length) {
          await sendSegmented(telefone, finalMessage.content);
          session.conversationHistory.push({
            role: 'assistant',
            content: finalMessage.content,
          } as ConversationMessage);
        }
        logger.info('Smart Trigo stopped — transfer complete', { sessionId });
        break;
      }

      // After closing: stop immediately
      if (session.encerrado) {
        logger.info('Smart Trigo stopped — conversation closed', { sessionId });
        break;
      }
    }

    await redisService.saveSession(session);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('processWithSmartTrigo fatal error', err);

    telegramService.notifyError({
      sessionId,
      telefone,
      funcao: 'processWithSmartTrigo',
      erro: errMsg,
    }).catch(() => {});

    // Fallback: transfer to human
    try {
      const session = await redisService.getSession(sessionId);
      if (session && !session.transferred) {
        await sendSegmented(
          telefone,
          'Desculpe o inconveniente. Vou te encaminhar para um de nossos consultores agora.'
        );
        await wtsService.transferSession(sessionId);
        session.transferred = true;
        await redisService.saveSession(session);
      }
    } catch (fallbackErr) {
      logger.error('Error fallback also failed', fallbackErr);
    }
  }
}
