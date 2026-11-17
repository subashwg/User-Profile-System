import { Global, Module } from '@nestjs/common';
import { RateLimitGuard } from './guards/rate-limit.guard.js';
import { RateLimiterService } from './services/rate-limiter.service.js';

@Global()
@Module({
  providers: [RateLimiterService, RateLimitGuard],
  exports: [RateLimiterService, RateLimitGuard],
})
export class CommonModule {}
