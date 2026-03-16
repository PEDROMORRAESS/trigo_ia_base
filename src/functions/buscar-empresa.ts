import { searchCompanyInfo } from '../services/knowledge-base.service';
import { logger } from '../utils/logger';

export async function buscarEmpresa(query: string) {
  logger.info('buscarEmpresa', { query });
  const results = await searchCompanyInfo(query);
  return {
    found: results.length > 0,
    items: results.map((r) => ({
      topic: r.topic,
      title: r.title,
      content: r.content,
    })),
  };
}
