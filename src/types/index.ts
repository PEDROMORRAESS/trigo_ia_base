// ─── WTS Webhook Payload ────────────────────────────────────────────────────

export interface WTSWebhookPayload {
  sessionId: string;
  contact: {
    id: string;
    name: string;
    phonenumber: string;
    avatar?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  lastMessage: {
    id: string;
    type: 'TEXT' | 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text: string | null;
    direction: string;
    origin: string;
    createdAt: string;
    file?: {
      publicUrl: string;
      mimeType: string;
      size?: number;
    } | null;
    details?: {
      file?: {
        publicUrl: string;
        mimeType: string;
      };
    };
  };
  channel?: {
    id: string;
    name: string;
    type: string;
  };
  department?: {
    id: string;
    name: string;
  };
}

// ─── WTS Message (fetched from API) ─────────────────────────────────────────

export interface WTSMessage {
  id: string;
  type: 'TEXT' | 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text: string | null;
  direction: string;
  origin: string;
  createdAt: string;
  file?: {
    publicUrl: string;
    mimeType: string;
    size?: number;
  } | null;
  details?: {
    file?: {
      publicUrl: string;
      mimeType: string;
    };
  };
}

// ─── Session Context (stored in Redis) ──────────────────────────────────────

export interface SessionContext {
  sessionId: string;
  contactId: string;
  telefone: string;
  nome?: string;
  ambiente?: string;        // sala, quarto, escritório, etc.
  produtoInteresse?: string; // sofa, mesa, cadeira, etc.
  conversationHistory: ConversationMessage[];
  transferred?: boolean;
  encerrado?: boolean;
  lastActivity: number;
}

// ─── OpenAI Conversation Messages ────────────────────────────────────────────

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

// ─── Product (Knowledge Base) ────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  category: string;
  environment: string[];
  description: string;
  materials: string[];
  colors: string[];
  image_url_1?: string;
  image_url_2?: string;
  image_url_3?: string;
  video_url?: string;
  tags: string[];
  available?: boolean;
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export interface Catalog {
  id: string;
  name: string;
  description?: string;
  category?: string;
  pdf_url: string;
  thumbnail_url?: string;
  active: boolean;
}

// ─── Company Info / FAQ ───────────────────────────────────────────────────────

export interface CompanyInfo {
  id: string;
  topic: string;
  title: string;
  content: string;
  active: boolean;
}
