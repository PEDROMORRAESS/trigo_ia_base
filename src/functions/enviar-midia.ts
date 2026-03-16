import { wtsService } from '../services/wts.service';
import { SessionContext } from '../types';
import { logger } from '../utils/logger';

export async function enviarMidia(
  imageUrl: string,
  caption: string,
  context: SessionContext
): Promise<string> {
  try {
    logger.info('enviarMidia', { imageUrl, sessionId: context.sessionId });
    await wtsService.sendMedia(context.telefone, imageUrl, caption);
    return 'success: imagem enviada';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('enviarMidia error', msg);
    return `erro: ${msg}`;
  }
}
