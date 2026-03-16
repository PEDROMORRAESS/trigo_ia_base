import dotenv from 'dotenv';
dotenv.config();

import { app } from './server';
import { redisService } from './services/redis.service';
import { startWebhookWorker } from './queue/webhook.queue';
import { CONFIG } from './config/constants';
import { logger } from './utils/logger';
import { telegramService } from './services/telegram.service';

async function bootstrap(): Promise<void> {
  logger.info('Starting Smart Trigo Agent...');

  try {
    await redisService.connect();
    logger.info('Redis ready');
  } catch (err) {
    logger.error('Redis connection failed — aborting', err);
    process.exit(1);
  }

  const worker = startWebhookWorker();

  const server = app.listen(CONFIG.PORT, () => {
    telegramService.notifyStartup().catch(() => {});
    logger.info('Smart Trigo Agent running', {
      port: CONFIG.PORT,
      env: CONFIG.NODE_ENV,
      webhook: `http://localhost:${CONFIG.PORT}/webhook/wts`,
      health: `http://localhost:${CONFIG.PORT}/health`,
    });
  });

  async function shutdown(signal: string): Promise<void> {
    logger.info(`${signal} — shutting down gracefully`);
    await worker.close();
    server.close(() => process.exit(0));
  }

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
