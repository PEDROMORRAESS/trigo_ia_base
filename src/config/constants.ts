import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const CONFIG = {
  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // WTS Chat
  WTS_TOKEN: requireEnv('WTS_TOKEN'),
  WTS_FROM: requireEnv('WTS_FROM'),
  WTS_DEPT_CONSULTOR: requireEnv('WTS_DEPT_CONSULTOR'),

  // OpenAI
  OPENAI_API_KEY: requireEnv('OPENAI_API_KEY'),

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_DB: parseInt(process.env.REDIS_DB || '0', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  REDIS_SESSION_TTL: parseInt(process.env.REDIS_SESSION_TTL || '604800', 10),

  // Optional webhook auth
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',

  // Supabase
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),

  // Mídia institucional
  TRIGO_INTRO_VIDEO_URL: process.env.TRIGO_INTRO_VIDEO_URL || '',
} as const;

// WTS API
export const WTS_BASE_URL = 'https://api.wts.chat';

// Debounce (ms)
export const DEBOUNCE_MS = 8000;

// Delay between message segments (ms)
export const MESSAGE_DELAY_MS = 1500;

// Maximum message segments to send
export const MAX_SEGMENTS = 5;

// Max chars per segment
export const MAX_CHARS_PER_SEGMENT = 300;

// Main agent model
export const AGENT_MODEL = 'gpt-4o';

// Summarization model
export const SUMMARY_MODEL = 'gpt-4o-mini';

// Summarize when history exceeds this many messages
export const SUMMARY_THRESHOLD = 40;

// Keep this many recent messages after summarization
export const SUMMARY_KEEP_RECENT = 20;

// Retry config
export const RETRY_MAX = 3;
export const RETRY_BASE_DELAY_MS = 1000;
