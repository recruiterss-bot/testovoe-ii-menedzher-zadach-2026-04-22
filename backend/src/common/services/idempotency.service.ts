import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

type IdempotencyStoredResponse = {
  payloadHash: string;
  statusCode: number;
  body: unknown;
  expiresAt: number;
};

type IdempotencyExecuteParams<T> = {
  scope: string;
  key: string;
  payload: unknown;
  ttlMs: number;
  handler: () => Promise<{ statusCode: number; body: T }>;
};

@Injectable()
export class IdempotencyService {
  private readonly storage = new Map<string, IdempotencyStoredResponse>();

  async execute<T>(
    params: IdempotencyExecuteParams<T>,
  ): Promise<{ statusCode: number; body: T; replayed: boolean }> {
    const scopedKey = `${params.scope}:${params.key.trim()}`;
    const payloadHash = this.hashPayload(params.payload);
    const now = Date.now();

    this.pruneExpired(now);

    const existing = this.storage.get(scopedKey);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key payload conflict',
          details: { idempotencyKey: params.key },
        });
      }

      return {
        statusCode: existing.statusCode,
        body: existing.body as T,
        replayed: true,
      };
    }

    const result = await params.handler();
    this.storage.set(scopedKey, {
      payloadHash,
      statusCode: result.statusCode,
      body: result.body,
      expiresAt: now + params.ttlMs,
    });

    return {
      statusCode: result.statusCode,
      body: result.body,
      replayed: false,
    };
  }

  private hashPayload(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private pruneExpired(now: number): void {
    for (const [key, value] of this.storage.entries()) {
      if (value.expiresAt <= now) {
        this.storage.delete(key);
      }
    }
  }
}
