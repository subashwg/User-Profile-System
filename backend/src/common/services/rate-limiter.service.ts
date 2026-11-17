import { Injectable } from '@nestjs/common';

interface RateLimitRecord {
  timestamps: number[];
}

@Injectable()
export class RateLimiterService {
  private readonly records = new Map<string, RateLimitRecord>();

  checkLimit(
    key: string,
    limit = 5,
    windowMs = 60000,
  ): { limited: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const record = this.records.get(key) || { timestamps: [] };

    // Filter out expired timestamps
    const validTimestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (validTimestamps.length >= limit) {
      const oldestValid = validTimestamps[0];
      const retryAfterSeconds = Math.ceil((windowMs - (now - oldestValid)) / 1000);
      return { limited: true, retryAfterSeconds };
    }

    validTimestamps.push(now);
    this.records.set(key, { timestamps: validTimestamps });

    return { limited: false, retryAfterSeconds: 0 };
  }

  reset() {
    this.records.clear();
  }
}
