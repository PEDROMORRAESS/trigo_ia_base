import { supabase } from './supabase.service';
import { Product, Catalog, CompanyInfo } from '../types';
import { logger } from '../utils/logger';

// ─── Products ─────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function searchProducts(query: string, limit = 4): Promise<Product[]> {
  const { data, error } = await supabase
    .from('trigo_products')
    .select('*')
    .eq('available', true);

  if (error) {
    logger.error('searchProducts error', error);
    return [];
  }

  const products = (data || []) as Product[];

  if (!query.trim()) return products.slice(0, limit);

  const terms = normalize(query)
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (terms.length === 0) return products.slice(0, limit);

  function score(p: Product): number {
    const haystack = normalize([
      p.name,
      p.category,
      p.description,
      ...(p.environment || []),
      ...(p.tags || []),
      ...(p.materials || []),
      ...(p.colors || []),
    ].join(' '));

    return terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
  }

  return products
    .filter((p) => score(p) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('trigo_products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Product;
}

// ─── Catalogs ─────────────────────────────────────────────────────────────────

export async function searchCatalogs(category?: string): Promise<Catalog[]> {
  let query = supabase
    .from('trigo_catalogs')
    .select('*')
    .eq('active', true);

  if (category) {
    query = query.or(`category.eq.${category},category.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('searchCatalogs error', error);
    return [];
  }

  return (data || []) as Catalog[];
}

// ─── Company Info ─────────────────────────────────────────────────────────────

export async function searchCompanyInfo(query: string): Promise<CompanyInfo[]> {
  const { data, error } = await supabase
    .from('trigo_company_info')
    .select('*')
    .eq('active', true);

  if (error) {
    logger.error('searchCompanyInfo error', error);
    return [];
  }

  const items = (data || []) as CompanyInfo[];

  if (!query.trim()) return items;

  const terms = normalize(query).split(/\s+/).filter((t) => t.length > 2);

  return items.filter((item) => {
    const haystack = normalize(`${item.topic} ${item.title} ${item.content}`);
    return terms.some((t) => haystack.includes(t));
  });
}
