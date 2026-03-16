import { searchProducts } from '../services/knowledge-base.service';
import { logger } from '../utils/logger';

export async function buscarProduto(query: string) {
  logger.info('buscarProduto', { query });
  const results = await searchProducts(query, 4);
  return {
    found: results.length > 0,
    count: results.length,
    products: results.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      environment: p.environment,
      description: p.description,
      materials: p.materials,
      colors: p.colors,
      image_url_1: p.image_url_1 || null,
      image_url_2: p.image_url_2 || null,
      image_url_3: p.image_url_3 || null,
      video_url: p.video_url || null,
      tags: p.tags,
    })),
  };
}
