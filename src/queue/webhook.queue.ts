import { Queue, Worker, Job } from 'bullmq';
import { CONFIG, DEBOUNCE_MS } from '../config/constants';
import { WTSWebhookPayload, WTSMessage } from '../types';
import { wtsService } from '../services/wts.service';
import { processWithSmartTrigo } from '../agents/smart-trigo.agent';
import { logger } from '../utils/logger';
import { telegramService } from '../services/telegram.service';

const connection = {
  host: CONFIG.REDIS_HOST,
  port: CONFIG.REDIS_PORT,
  password: CONFIG.REDIS_PASSWORD || undefined,
  db: CONFIG.REDIS_DB,
};

export const webhookQueue = new Queue('trigo-webhook', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 10,
    attempts: 1,
  },
});

export async function enqueueWebhook(payload: WTSWebhookPayload): Promise<void> {
  const jobId = payload.sessionId;

  const existing = await webhookQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === 'delayed' || state === 'waiting' || state === 'failed') {
      await existing.remove();
      logger.info('Replaced existing job', { sessionId: jobId, state });
    }
  }

  await webhookQueue.add('process', payload, {
    jobId,
    delay: DEBOUNCE_MS,
  });

  logger.info('Webhook job enqueued', { sessionId: jobId, delayMs: DEBOUNCE_MS });
}

export function startWebhookWorker(): Worker {
  const worker = new Worker(
    'trigo-webhook',
    async (job: Job<WTSWebhookPayload>) => {
      const payload = job.data;
      const { sessionId, lastMessage } = payload;

      const since = lastMessage?.createdAt
        ? lastMessage.createdAt
        : new Date(Date.now() - 60_000).toISOString();

      logger.info('Processing webhook job', { sessionId, messageId: lastMessage?.id });

      let messages = await wtsService.fetchNewMessages(sessionId, since);

      if (messages.length === 0 && lastMessage) {
        logger.info('API returned no messages — using payload fallback', { sessionId });
        messages = [
          {
            id: lastMessage.id,
            type: lastMessage.type,
            text: lastMessage.text,
            direction: 'FROM_HUB',
            origin: 'GATEWAY',
            createdAt: lastMessage.createdAt,
            file: lastMessage.file,
            details: lastMessage.details,
          } as WTSMessage,
        ];
      }

      if (messages.length === 0) {
        logger.info('No messages to process — skipping', { sessionId });
        return;
      }

      await processWithSmartTrigo(payload, messages);
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, sessionId: job.data.sessionId });
  });

  worker.on('failed', (job, err) => {
    const errMsg = (err as Error).message;
    logger.error('Job failed', { jobId: job?.id, error: errMsg });
    telegramService.notifyJobFailed(job?.id || 'unknown', errMsg).catch(() => {});
  });

  logger.info('BullMQ webhook worker started');
  return worker;
}
