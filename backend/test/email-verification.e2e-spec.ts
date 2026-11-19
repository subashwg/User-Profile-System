import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Email Verification Flow (e2e)', () => {
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

  it('Happy Path: should verify email using token sent upon registration', async () => {
    // 1. Register
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'verify-me@example.com',
        password: 'securePassword123',
      })
      .expect(201);

    expect(regRes.body.user.email_verified).toBe(false);

    // 2. Capture token from dev mailer
    const sentEmail = mailService.getLatestEmail('verify-me@example.com');
    expect(sentEmail).toBeDefined();
    expect(sentEmail?.type).toBe('verify_email');
    expect(sentEmail?.token).toBeDefined();

    const rawToken = sentEmail!.token;

    // 3. Call POST /auth/verify-email
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: rawToken })
      .expect(200);

    expect(verifyRes.body.message).toBe('Email verified successfully');
    expect(verifyRes.body.email_verified).toBe(true);

    // 4. Verify in DB
    const userInDb = await prisma.user.findUnique({
      where: { email: 'verify-me@example.com' },
    });
    expect(userInDb?.email_verified).toBe(true);

    const tokenInDb = await prisma.emailToken.findFirst({
      where: { user_id: userInDb?.id },
    });
    expect(tokenInDb?.used_at).not.toBeNull();
  });

  it('Failure Case: should reject already used verification token', async () => {
    // 1. Register & verify
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'reuse@example.com',
        password: 'securePassword123',
      })
      .expect(201);

    const rawToken = mailService.getLatestEmail('reuse@example.com')!.token;

    // First use - succeeds
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: rawToken })
      .expect(200);

    // Second use - must fail
    const reuseRes = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: rawToken })
      .expect(400);

    expect(reuseRes.body.message).toContain('Invalid, expired, or already used');
  });

  it('Failure Case: should reject expired verification token', async () => {
    // 1. Create user and expired token directly in DB
    const user = await prisma.user.create({
      data: {
        email: 'expired@example.com',
        email_verified: false,
      },
    });

    const expiredToken = 'expired-raw-token-12345';
    const { createHash } = await import('crypto');
    const hash = createHash('sha256').update(expiredToken).digest('hex');

    await prisma.emailToken.create({
      data: {
        user_id: user.id,
        purpose: 'verify_email',
        token_hash: hash,
        expires_at: new Date(Date.now() - 1000 * 60), // Expired 1 minute ago
      },
    });

    // Attempt verification
    const res = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: expiredToken })
      .expect(400);

    expect(res.body.message).toContain('Invalid, expired, or already used');
  });

  it('Failure Case: should reject non-existent / tampered token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: 'completely-bogus-token' })
      .expect(400);

    expect(res.body.message).toContain('Invalid, expired, or already used');
  });

  describe('POST /auth/resend-verification', () => {
    it('Happy Path: should allow logged in unverified user to resend verification link', async () => {
      // 1. Register to obtain session cookie
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'resend@example.com',
          password: 'securePassword123',
        })
        .expect(201);

      const cookie = regRes.headers['set-cookie'];
      mailService.clearLatestEmails();

      // 2. Request resend
      const resendRes = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('Cookie', cookie)
        .expect(200);

      expect(resendRes.body.message).toBe('Verification link sent');

      // 3. Verify new email was sent
      const newEmail = mailService.getLatestEmail('resend@example.com');
      expect(newEmail).toBeDefined();

      // 4. Verify with the new token
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: newEmail!.token })
        .expect(200);
    });

    it('Failure Case: should reject resend when email is already verified', async () => {
      // 1. Register & verify
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'already-verified@example.com',
          password: 'securePassword123',
        })
        .expect(201);

      const cookie = regRes.headers['set-cookie'];
      const token = mailService.getLatestEmail('already-verified@example.com')!.token;

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token })
        .expect(200);

      // 2. Attempt resend
      const res = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('Cookie', cookie)
        .expect(400);

      expect(res.body.message).toBe('Email is already verified');
    });

    it('Failure Case: should reject resend without session cookie', async () => {
      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .expect(401);
    });
  });
});
