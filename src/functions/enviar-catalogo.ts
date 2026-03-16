import { searchCatalogs } from '../services/knowledge-base.service';
import { wtsService } from '../services/wts.service';
import { SessionContext } from '../types';
import { logger } from '../utils/logger';

export async function enviarCatalogo(
  category: string | undefined,
  context: SessionContext
): Promise<string> {
  logger.info('enviarCatalogo', { category, sessionId: context.sessionId });

  const catalogs = await searchCatalogs(category);

  if (catalogs.length === 0) {
    return 'nenhum catálogo disponível para esta categoria';
  }

  for (const catalog of catalogs) {
    await wtsService.sendDocument(context.telefone, catalog.pdf_url, catalog.name);
  }

  return `${catalogs.length} catálogo(s) enviado(s)`;
}
