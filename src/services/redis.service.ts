import Redis from 'ioredis';
import { CONFIG } from '../config/constants';
import { SessionContext } from '../types';
import { logger } from '../utils/logger';

class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: CONFIG.REDIS_HOST,
      port: CONFIG.REDIS_PORT,
      db: CONFIG.REDIS_DB,
      password: CONFIG.REDIS_PASSWORD || undefined,
      lazyConnect: true,
    });

    this.client.on('connect', () => logger.info('Redis connected'));
    this.client.on('error', (err: Error) => logger.error('Redis error', err.message));
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  private sessionKey(sessionId: string): string {
    return `trigo:session:${sessionId}`;
  }

  async getSession(sessionId: string): Promise<SessionContext | null> {
    try {
      const data = await this.client.get(this.sessionKey(sessionId));
      if (!data) return null;
      return JSON.parse(data) as SessionContext;
    } catch (err) {
      logger.error('Redis getSession error', err);
      return null;
    }
  }

  async saveSession(session: SessionContext): Promise<void> {
    try {
      session.lastActivity = Date.now();
      await this.client.setex(
        this.sessionKey(session.sessionId),
        CONFIG.REDIS_SESSION_TTL,
        JSON.stringify(session)
      );
    } catch (err) {
      logger.error('Redis saveSession error', err);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.client.del(this.sessionKey(sessionId));
    } catch (err) {
      logger.error('Redis deleteSession error', err);
    }
  }

  async setLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.set(`trigo:${key}`, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      logger.error('Redis setLock error', err);
      return true;
    }
  }

  async deleteLock(key: string): Promise<void> {
    try {
      await this.client.del(`trigo:${key}`);
    } catch (err) {
      logger.error('Redis deleteLock error', err);
    }
  }
}

export const redisService = new RedisService();
