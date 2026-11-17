import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AppleService, type AppleUserInfo } from '../src/auth/apple/apple.service.js';
import { GoogleService, type GoogleUserInfo } from '../src/auth/google/google.service.js';
import { RateLimiterService } from '../src/common/services/rate-limiter.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Account Settings & Rate Limiting Pass (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailService: MailService;
  let rateLimiter: RateLimiterService;

  const mockGoogleService = {
    generateAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth'),
    verifyCodeAndGetUserInfo: vi.fn(async (code: string): Promise<GoogleUserInfo> => {
      if (code === 'google-link-code-valid') {
        return {
          sub: 'google-sub-linked-123',
          email: 'settings-user@example.com',
          email_verified: true,
          name: 'Settings Google',
        };
      }
      if (code === 'google-link-conflict') {
        return {
          sub: 'google-sub-already-taken',
          email: 'other@example.com',
          email_verified: true,
        };
      }
      throw new Error('Invalid code');
    }),
  };

  const mockAppleService = {
    generateAuthUrl: vi.fn(() => 'https://appleid.apple.com/auth/authorize'),
    verifyIdToken: vi.fn(async (idToken: string): Promise<AppleUserInfo> => {
      if (idToken === 'apple-link-token-valid') {
        return {
          sub: 'apple-sub-linked-456',
          email: 'settings-user@example.com',
          email_verified: true,
          name: 'Settings Apple',
        };
      }
      throw new Error('Invalid Apple token');
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleService)
      .useValue(mockGoogleService)
      .overrideProvider(AppleService)
      .useValue(mockAppleService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
    mailService = app.get(MailService);
    rateLimiter = app.get(RateLimiterService);
  }, 20000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    rateLimiter.reset();
    mailService.clearLatestEmails();
    await prisma.emailToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.loginMethod.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('GET /account/login-methods', () => {
    it('Failure Case: should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .get('/account/login-methods')
        .expect(401);
    });

    it('Happy Path: should list connected login methods for user', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'methods-test@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .get('/account/login-methods')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body.email).toBe('methods-test@example.com');
      expect(res.body.login_methods).toHaveLength(1);
      expect(res.body.login_methods[0].type).toBe('email');
      expect(res.body.login_methods[0].password_hash).toBeUndefined(); // Security: never expose hash
    });
  });

  describe('POST /account/change-password', () => {
    it('Failure Case: should reject with 401 on wrong current password', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'pw-test@example.com',
          password: 'InitialPassword123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/account/change-password')
        .set('Cookie', sessionCookie)
        .send({
          currentPassword: 'WrongPassword!',
          newPassword: 'BrandNewPassword123',
        })
        .expect(401);

      expect(res.body.message).toContain('Current password does not match');
    });

    it('Failure Case: should reject new password shorter than 8 characters', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'pw-short@example.com',
          password: 'InitialPassword123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      await request(app.getHttpServer())
        .post('/account/change-password')
        .set('Cookie', sessionCookie)
        .send({
          currentPassword: 'InitialPassword123',
          newPassword: 'short',
        })
        .expect(400);
    });

    it('Happy Path: should successfully change password and allow login with new password', async () => {
      // 1. Register
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'pw-success@example.com',
          password: 'InitialPassword123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      // 2. Change password
      const changeRes = await request(app.getHttpServer())
        .post('/account/change-password')
        .set('Cookie', sessionCookie)
        .send({
          currentPassword: 'InitialPassword123',
          newPassword: 'BrandNewPassword456',
        })
        .expect(200);

      expect(changeRes.body.message).toBe('Password changed successfully');

      // 3. Old password fails
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'pw-success@example.com',
          password: 'InitialPassword123',
        })
        .expect(401);

      // 4. New password succeeds
      const newLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'pw-success@example.com',
          password: 'BrandNewPassword456',
        })
        .expect(200);

      expect(newLoginRes.body.message).toBe('Login successful');
    });
  });

  describe('POST /account/link/google & /account/link/apple', () => {
    it('Happy Path: should link Google and Apple methods to existing user', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'settings-user@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      // Link Google
      const linkGoogleRes = await request(app.getHttpServer())
        .post('/account/link/google')
        .set('Cookie', sessionCookie)
        .send({ credential: 'google-link-code-valid' })
        .expect(200);

      expect(linkGoogleRes.body.message).toContain('linked successfully');

      // Link Apple
      const linkAppleRes = await request(app.getHttpServer())
        .post('/account/link/apple')
        .set('Cookie', sessionCookie)
        .send({ credential: 'apple-link-token-valid' })
        .expect(200);

      expect(linkAppleRes.body.message).toContain('linked successfully');

      // Check login methods list has all 3: email, google, apple
      const methodsRes = await request(app.getHttpServer())
        .get('/account/login-methods')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(methodsRes.body.login_methods).toHaveLength(3);
      const types = methodsRes.body.login_methods.map((m: any) => m.type);
      expect(types).toContain('email');
      expect(types).toContain('google');
      expect(types).toContain('apple');
    });

    it('Failure Case: should reject linking if Google account is already linked to another user', async () => {
      // 1. Another user has the Google ID
      const userOther = await prisma.user.create({
        data: {
          email: 'other@example.com',
          login_methods: {
            create: {
              type: 'google',
              provider_user_id: 'google-sub-already-taken',
            },
          },
        },
      });
      expect(userOther).toBeDefined();

      // 2. Current user registers
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'current-user@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      // 3. Current user attempts to link the already taken Google account
      const res = await request(app.getHttpServer())
        .post('/account/link/google')
        .set('Cookie', sessionCookie)
        .send({ credential: 'google-link-conflict' })
        .expect(409);

      expect(res.body.message).toContain('already linked to another user');
    });
  });

  describe('Rate Limiting Pass', () => {
    it('Security Rule: should block requests exceeding 5 attempts with 429 Too Many Requests', async () => {
      const email = 'rate-limit-victim@example.com';

      // Attempts 1 through 5 succeed or return normal auth failure
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('x-test-rate-limit', 'true')
          .send({
            email,
            password: 'WrongPassword!',
          })
          .expect(401);
      }

      // Attempt 6 must be blocked by RateLimitGuard with 429 Too Many Requests
      const blockedRes = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-test-rate-limit', 'true')
        .send({
          email,
          password: 'WrongPassword!',
        })
        .expect(429);

      expect(blockedRes.body.message).toContain('Too many requests');
      expect(blockedRes.headers['retry-after']).toBeDefined();
    });
  });
});
