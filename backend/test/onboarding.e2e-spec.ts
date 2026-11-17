import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Onboarding & Username Availability Flow (e2e)', () => {
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
    prisma = app.get(PrismaService);
    mailService = app.get(MailService);
  }, 20000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    mailService.clearLatestEmails();
    await prisma.emailToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.loginMethod.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('GET /users/username-available', () => {
    it('Failure Case: should reject unauthenticated requests with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/username-available?username=valid_handle')
        .expect(401);

      expect(res.body.message).toContain('Authentication required');
    });

    it('Validation: should report unavailable for short or invalid usernames', async () => {
      // 1. Create a user and get session cookie
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'handle-check@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      // Too short
      const shortRes = await request(app.getHttpServer())
        .get('/users/username-available?username=ab')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(shortRes.body.available).toBe(false);
      expect(shortRes.body.reason).toContain('at least 3 characters');

      // Invalid characters
      const invalidRes = await request(app.getHttpServer())
        .get('/users/username-available?username=john-doe!')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(invalidRes.body.available).toBe(false);
      expect(invalidRes.body.reason).toContain('lowercase letters, numbers, and underscores');
    });

    it('Reserved words: should report reserved usernames as unavailable', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'reserved-check@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      for (const reserved of ['admin', 'api', 'login', 'settings', 'onboarding']) {
        const res = await request(app.getHttpServer())
          .get(`/users/username-available?username=${reserved}`)
          .set('Cookie', sessionCookie)
          .expect(200);

        expect(res.body.available).toBe(false);
        expect(res.body.reason).toContain('reserved');
      }
    });

    it('Collision check: should report taken usernames as unavailable', async () => {
      // Create user A who already completed onboarding with username "alice"
      await prisma.user.create({
        data: {
          email: 'alice@example.com',
          name: 'Alice Cooper',
          username: 'alice',
          onboarding_completed: true,
        },
      });

      // User B registers
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'bob@example.com',
          password: 'Password123',
        })
        .expect(201);

      const bobCookie = regRes.headers['set-cookie'];

      // Bob checks "alice"
      const res = await request(app.getHttpServer())
        .get('/users/username-available?username=alice')
        .set('Cookie', bobCookie)
        .expect(200);

      expect(res.body.available).toBe(false);
      expect(res.body.reason).toContain('already taken');

      // Bob checks "bob_123"
      const resOk = await request(app.getHttpServer())
        .get('/users/username-available?username=bob_123')
        .set('Cookie', bobCookie)
        .expect(200);

      expect(resOk.body.available).toBe(true);
    });
  });

  describe('POST /onboarding/complete', () => {
    it('Failure Case: should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post('/onboarding/complete')
        .send({
          name: 'Anonymous',
          username: 'anon_user',
        })
        .expect(401);
    });

    it('Failure Case: should reject invalid payload with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-onboard@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      // Missing name
      await request(app.getHttpServer())
        .post('/onboarding/complete')
        .set('Cookie', sessionCookie)
        .send({
          username: 'valid_handle',
        })
        .expect(400);

      // Invalid username (symbols)
      await request(app.getHttpServer())
        .post('/onboarding/complete')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Valid Name',
          username: 'invalid handle!',
        })
        .expect(400);
    });

    it('Failure Case: should reject reserved username with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'admin-claim@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/onboarding/complete')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Super Admin',
          username: 'admin',
        })
        .expect(400);

      expect(res.body.message).toContain('reserved');
    });

    it('Failure Case: should reject taken username with 409 Conflict', async () => {
      await prisma.user.create({
        data: {
          email: 'existing-creator@example.com',
          name: 'Creator',
          username: 'creator',
          onboarding_completed: true,
        },
      });

      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newbie@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/onboarding/complete')
        .set('Cookie', sessionCookie)
        .send({
          name: 'New Creator',
          username: 'creator',
        })
        .expect(409);

      expect(res.body.message).toContain('already taken');
    });

    it('Happy Path & Resume logic: should complete onboarding and reflect in GET /auth/me', async () => {
      // 1. Sign up new user
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'onboard-test@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      // 2. Resume logic check: GET /auth/me initially reports onboarding_completed = false
      const meBefore = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(meBefore.body.user.onboarding_completed).toBe(false);
      expect(meBefore.body.user.name).toBeNull();
      expect(meBefore.body.user.username).toBeNull();

      // 3. Complete onboarding
      const completeRes = await request(app.getHttpServer())
        .post('/onboarding/complete')
        .set('Cookie', sessionCookie)
        .send({
          name: 'John Doe',
          username: 'johndoe',
        })
        .expect(200);

      expect(completeRes.body.message).toBe('Onboarding completed');
      expect(completeRes.body.user.name).toBe('John Doe');
      expect(completeRes.body.user.username).toBe('johndoe');
      expect(completeRes.body.user.onboarding_completed).toBe(true);

      // 4. Verify subsequent GET /auth/me reflects completed onboarding
      const meAfter = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(meAfter.body.user.onboarding_completed).toBe(true);
      expect(meAfter.body.user.name).toBe('John Doe');
      expect(meAfter.body.user.username).toBe('johndoe');
    });
  });
});
