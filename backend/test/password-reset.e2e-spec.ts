import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Password Reset Flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailService: MailService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    await app.listen(0);
    prisma = app.get(PrismaService);
    mailService = app.get(MailService);
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    mailService.clearLatestEmails();
    await prisma.$transaction([
      prisma.skill.deleteMany(),
      prisma.role.deleteMany(),
      prisma.profile.deleteMany(),
      prisma.emailToken.deleteMany(),
      prisma.session.deleteMany(),
      prisma.loginMethod.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  it('Happy Path: should complete full forgot and reset password flow, ending prior sessions', async () => {
    // 1. Register user
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'reset-tester@example.com',
        password: 'initialPassword123',
      })
      .expect(201);

    const oldSessionCookie = regRes.headers['set-cookie'];

    // Verify session is active
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', oldSessionCookie)
      .expect(200);

    // 2. Request forgot password
    const forgotRes = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'reset-tester@example.com' })
      .expect(200);

    expect(forgotRes.body.message).toBe('If this email exists, we sent a link');

    // 3. Extract reset token from mailer
    const resetEmail = mailService.getLatestEmail('reset-tester@example.com');
    expect(resetEmail).toBeDefined();
    expect(resetEmail?.type).toBe('reset_password');
    const rawToken = resetEmail!.token;

    // 4. Submit new password
    const resetRes = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token: rawToken,
        newPassword: 'brandNewPassword456',
      })
      .expect(200);

    expect(resetRes.body.message).toContain('Password has been reset successfully');

    // 5. CRITICAL: Verify old session was ended
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', oldSessionCookie)
      .expect(401);

    // 6. Verify old password is rejected
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'reset-tester@example.com',
        password: 'initialPassword123',
      })
      .expect(401);

    // 7. Verify new password logs in successfully
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'reset-tester@example.com',
        password: 'brandNewPassword456',
      })
      .expect(200);

    expect(loginRes.body.user.email).toBe('reset-tester@example.com');
  });

  it('Security Rule: non-existent email must return identical generic message', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'nonexistent-person@example.com' })
      .expect(200);

    expect(res.body.message).toBe('If this email exists, we sent a link');
    // Ensure no email was sent
    expect(mailService.latestEmails).toHaveLength(0);
  });

  it('Failure Case: should reject already used reset token', async () => {
    // 1. Create user and request reset
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'reuse-token@example.com',
        password: 'firstPassword123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'reuse-token@example.com' })
      .expect(200);

    const token = mailService.getLatestEmail('reuse-token@example.com')!.token;

    // First use - succeeds
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token,
        newPassword: 'secondPassword123',
      })
      .expect(200);

    // Second use - must fail
    const secondRes = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token,
        newPassword: 'thirdPassword123',
      })
      .expect(400);

    expect(secondRes.body.message).toContain('Invalid, expired, or already used');
  });

  it('Failure Case: should reject expired reset token (> 30 minutes)', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'expired-reset@example.com',
      },
    });

    const expiredToken = 'expired-reset-token-sample';
    const { createHash } = await import('crypto');
    const hash = createHash('sha256').update(expiredToken).digest('hex');

    await prisma.emailToken.create({
      data: {
        user_id: user.id,
        purpose: 'reset_password',
        token_hash: hash,
        expires_at: new Date(Date.now() - 1000 * 60 * 35), // Expired 35 mins ago
      },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token: expiredToken,
        newPassword: 'newValidPassword123',
      })
      .expect(400);

    expect(res.body.message).toContain('Invalid, expired, or already used');
  });

  it('Failure Case: should reject new password shorter than 8 characters', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token: 'any-token',
        newPassword: 'short',
      })
      .expect(400);

    expect(res.body.message).toContain('Password must be at least 8 characters long');
  });
});
