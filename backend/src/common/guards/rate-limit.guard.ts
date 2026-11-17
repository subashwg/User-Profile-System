import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RateLimiterService } from '../services/rate-limiter.service.js';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // In test environment, only enforce rate limiting if explicitly enabled for the test
    const isTest = process.env.NODE_ENV === 'test';
    const forceTestRateLimit = req.headers['x-test-rate-limit'] === 'true';
    if (isTest && !forceTestRateLimit) {
      return true;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;

    // Check rate limit by IP
    const ipCheck = this.rateLimiter.checkLimit(`ip:${ip}`, 5, 60000);
    if (ipCheck.limited) {
      res.setHeader('Retry-After', String(ipCheck.retryAfterSeconds));
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check rate limit by IP + Email if email is present
    if (email) {
      const emailCheck = this.rateLimiter.checkLimit(`email:${ip}:${email}`, 5, 60000);
      if (emailCheck.limited) {
        res.setHeader('Retry-After', String(emailCheck.retryAfterSeconds));
        throw new HttpException(
          'Too many requests. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }
}
