import axios from 'axios';
import { CONFIG, WTS_BASE_URL } from '../config/constants';
import { WTSMessage } from '../types';
import { logger } from '../utils/logger';

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${CONFIG.WTS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export const wtsService = {
  // ─── Messages ───────────────────────────────────────────────────────────────

  async fetchNewMessages(sessionId: string, after: string): Promise<WTSMessage[]> {
    try {
      const response = await axios.get(
        `${WTS_BASE_URL}/chat/v1/session/${sessionId}/message`,
        {
          headers: headers(),
          params: {
            'CreatedAt.After': after,
            OrderBy: 'createdAt',
            OrderDirection: 'ASCENDING',
          },
        }
      );
      const items: WTSMessage[] = response.data?.items || [];
      return items.filter(
        (msg) => msg.direction === 'FROM_HUB' && msg.origin === 'GATEWAY'
      );
    } catch (err) {
      logger.error('wtsService.fetchNewMessages error', err);
      return [];
    }
  },

  async sendMessage(telefone: string, texto: string): Promise<void> {
    const phone = telefone.replace(/\D/g, '');
    const payload = {
      from: CONFIG.WTS_FROM,
      to: phone,
      body: { text: texto },
    };
    try {
      const res = await axios.post(
        `${WTS_BASE_URL}/chat/v1/message/send`,
        payload,
        { headers: headers() }
      );
      logger.info('Message sent', { to: phone, status: res.status, chars: texto.length });
    } catch (err: unknown) {
      const e = err as { response?: { status: number; data: unknown } };
      logger.error('sendMessage failed', { to: phone, status: e.response?.status, data: e.response?.data });
      throw err;
    }
  },

  /** Send an image to a phone number */
  async sendMedia(telefone: string, imageUrl: string, caption?: string): Promise<void> {
    const phone = telefone.replace(/\D/g, '');
    const payload = {
      from: CONFIG.WTS_FROM,
      to: phone,
      body: {
        type: 'IMAGE',
        url: imageUrl,
        ...(caption ? { caption } : {}),
      },
    };
    try {
      const res = await axios.post(
        `${WTS_BASE_URL}/chat/v1/message/send`,
        payload,
        { headers: headers() }
      );
      logger.info('Media sent', { to: phone, status: res.status, imageUrl });
    } catch (err: unknown) {
      const e = err as { response?: { status: number; data: unknown } };
      logger.error('sendMedia failed', { to: phone, status: e.response?.status, data: e.response?.data });
      throw err;
    }
  },

  /** Send a video to a phone number */
  async sendVideo(telefone: string, videoUrl: string, caption?: string): Promise<void> {
    const phone = telefone.replace(/\D/g, '');
    const payload = {
      from: CONFIG.WTS_FROM,
      to: phone,
      body: {
        type: 'VIDEO',
        url: videoUrl,
        ...(caption ? { caption } : {}),
      },
    };
    try {
      const res = await axios.post(
        `${WTS_BASE_URL}/chat/v1/message/send`,
        payload,
        { headers: headers() }
      );
      logger.info('Video sent', { to: phone, status: res.status, videoUrl });
    } catch (err: unknown) {
      const e = err as { response?: { status: number; data: unknown } };
      logger.error('sendVideo failed', { to: phone, status: e.response?.status, data: e.response?.data });
      throw err;
    }
  },

  /** Send a document/PDF to a phone number */
  async sendDocument(telefone: string, documentUrl: string, filename?: string): Promise<void> {
    const phone = telefone.replace(/\D/g, '');
    const payload = {
      from: CONFIG.WTS_FROM,
      to: phone,
      body: {
        type: 'DOCUMENT',
        url: documentUrl,
        ...(filename ? { filename } : {}),
      },
    };
    try {
      const res = await axios.post(
        `${WTS_BASE_URL}/chat/v1/message/send`,
        payload,
        { headers: headers() }
      );
      logger.info('Document sent', { to: phone, status: res.status, documentUrl });
    } catch (err: unknown) {
      const e = err as { response?: { status: number; data: unknown } };
      logger.error('sendDocument failed', { to: phone, status: e.response?.status, data: e.response?.data });
      throw err;
    }
  },

  async sendInternalNote(sessionId: string, text: string): Promise<void> {
    await axios.post(
      `${WTS_BASE_URL}/chat/v1/session/${sessionId}/note`,
      { text },
      { headers: { ...headers(), 'Content-Type': 'application/*+json' } }
    );
    logger.info('Internal note sent', { sessionId });
  },

  async transferSession(sessionId: string): Promise<void> {
    try {
      await axios.put(
        `${WTS_BASE_URL}/chat/v1/session/${sessionId}/transfer`,
        {
          type: 'DEPARTMENT',
          newDepartmentId: CONFIG.WTS_DEPT_CONSULTOR,
        },
        { headers: headers() }
      );
      logger.info('Session transferred to consultant', { sessionId });
    } catch (err: unknown) {
      const e = err as { response?: { status: number; data: unknown } };
      logger.error('transferSession failed', {
        sessionId,
        status: e.response?.status,
        data: JSON.stringify(e.response?.data),
      });
      throw err;
    }
  },
};
