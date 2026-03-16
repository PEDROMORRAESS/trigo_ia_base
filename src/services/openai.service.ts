import OpenAI from 'openai';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CONFIG, AGENT_MODEL, SUMMARY_MODEL } from '../config/constants';
import { ConversationMessage } from '../types';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });

export const openaiService = {
  async transcribeAudio(audioUrl: string): Promise<string> {
    return withRetry(
      async () => {
        logger.info('Transcribing audio', { url: audioUrl });
        const response = await axios.get<ArrayBuffer>(audioUrl, { responseType: 'arraybuffer' });

        const tmpFile = path.join(os.tmpdir(), `trigo_audio_${Date.now()}.ogg`);
        fs.writeFileSync(tmpFile, Buffer.from(response.data));

        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tmpFile) as unknown as File,
          model: 'whisper-1',
          language: 'pt',
        });

        fs.unlinkSync(tmpFile);
        return transcription.text;
      },
      { label: 'transcribeAudio' }
    ).catch(() => '[Áudio não transcrito]');
  },

  async analyzeImage(imageUrl: string): Promise<string> {
    return withRetry(
      async () => {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'O cliente enviou esta imagem. Descreva brevemente o que está nela — pode ser foto de ambiente, móvel, inspiração de decoração ou outra coisa.' },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
          max_tokens: 300,
        });
        return response.choices[0]?.message?.content || '[Imagem não analisada]';
      },
      { label: 'analyzeImage' }
    ).catch(() => '[Imagem não analisada]');
  },

  async summarizeHistory(messages: ConversationMessage[]): Promise<string> {
    return withRetry(
      async () => {
        const text = messages
          .filter((m) => m.content)
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join('\n');

        const response = await openai.chat.completions.create({
          model: SUMMARY_MODEL,
          messages: [
            {
              role: 'system',
              content: 'Você resume atendimentos de loja de móveis. Preserve: nome do cliente, ambiente de interesse, produto buscado, dúvidas levantadas, se foi transferido para consultor.',
            },
            { role: 'user', content: `Resuma esta conversa:\n\n${text}` },
          ],
          max_tokens: 500,
        });
        return response.choices[0]?.message?.content || '';
      },
      { label: 'summarizeHistory' }
    );
  },

  async runAgent(
    systemPrompt: string,
    messages: ConversationMessage[],
    tools: OpenAI.Chat.ChatCompletionTool[]
  ): Promise<OpenAI.Chat.ChatCompletionMessage> {
    return withRetry(
      async () => {
        const response = await openai.chat.completions.create({
          model: AGENT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...(messages as OpenAI.Chat.ChatCompletionMessageParam[]),
          ],
          tools,
          tool_choice: 'auto',
          max_tokens: 1024,
        });
        return response.choices[0].message;
      },
      { label: 'runAgent' }
    );
  },
};
