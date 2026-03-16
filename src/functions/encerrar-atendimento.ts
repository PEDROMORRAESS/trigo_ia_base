import { wtsService } from '../services/wts.service';
import { SessionContext } from '../types';
import { logger } from '../utils/logger';

export async function encerrarAtendimento(context: SessionContext): Promise<string> {
  try {
    logger.info('encerrarAtendimento', { sessionId: context.sessionId });
    await wtsService.sendInternalNote(
      context.sessionId,
      `Smart Trigo: Atendimento encerrado\nCliente: ${context.nome || 'Desconhecido'} | Tel: ${context.telefone}${context.ambiente ? ` | Ambiente: ${context.ambiente}` : ''}${context.produtoInteresse ? ` | Interesse: ${context.produtoInteresse}` : ''}`
    ).catch(() => {});
    return 'success: atendimento encerrado';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('encerrarAtendimento error', msg);
    return `erro: ${msg}`;
  }
}
