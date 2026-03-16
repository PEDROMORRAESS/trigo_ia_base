import { wtsService } from '../services/wts.service';
import { SessionContext } from '../types';
import { logger } from '../utils/logger';

export async function transferirConsultor(
  motivo: string,
  context: SessionContext
): Promise<string> {
  try {
    logger.info('transferirConsultor', { sessionId: context.sessionId, motivo });
    await wtsService.sendInternalNote(
      context.sessionId,
      `Smart Trigo: Transferindo para consultor\nMotivo: ${motivo}\nCliente: ${context.nome || 'Desconhecido'} | Tel: ${context.telefone}${context.ambiente ? ` | Ambiente: ${context.ambiente}` : ''}${context.produtoInteresse ? ` | Interesse: ${context.produtoInteresse}` : ''}`
    ).catch(() => {});
    await wtsService.transferSession(context.sessionId);
    return 'success: transferido para consultor';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('transferirConsultor error', msg);
    return `erro: ${msg}`;
  }
}
