import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config/constants';

export const supabase = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);
