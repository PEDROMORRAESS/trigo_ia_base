import { wtsService } from '../services/wts.service';
import { SessionContext } from '../types';
import { logger } from '../utils/logger';

const MEDIA_DELAY_MS = 2000;

export async function enviarMidia(
  imageUrl: string,
  caption: string,
  context: SessionContext
): Promise<string> {
  try {
    logger.info('enviarMidia', { imageUrl, sessionId: context.sessionId });
    await wtsService.sendMedia(context.telefone, imageUrl, caption);
    await new Promise((resolve) => setTimeout(resolve, MEDIA_DELAY_MS));
    return 'success: imagem enviada';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('enviarMidia error', msg);
    return `erro: ${msg}`;
  }
}
