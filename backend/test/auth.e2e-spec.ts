import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Auth Flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
  }, 20000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.session.deleteMany({});
    await prisma.loginMethod.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('POST /auth/register', () => {
    it('Happy Path: should register a new user, start a session and return session cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'creator@example.com',
          password: 'securepassword123',
        })
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('creator@example.com');
      expect(res.body.user.email_verified).toBe(false);
      expect(res.body.user.onboarding_completed).toBe(false);
      expect(res.body.user.password_hash).toBeUndefined();

      // Check session cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/session_id=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);

      // Verify in DB that password was hashed
      const loginMethod = await prisma.loginMethod.findFirst({
        where: { user_id: res.body.user.id },
      });
      expect(loginMethod?.password_hash).toMatch(/^\$argon2/);
    });

    it('Failure Case: should reject registration if email is already registered', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'securepassword123',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'anotherpassword123',
        })
        .expect(409);

      expect(res.body.message).toBe('Email already in use');
    });

    it('Failure Case: should reject registration with password shorter than 8 characters', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'shortpass@example.com',
          password: 'short',
        })
        .expect(400);

      expect(res.body.message).toContain('Password must be at least 8 characters long');
    });

    it('Failure Case: should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'securepassword123',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'subash@example.com',
          password: 'correctpassword123',
        })
        .expect(201);
    });

    it('Happy Path: should log in with correct credentials and return session cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'subash@example.com',
          password: 'correctpassword123',
        })
        .expect(200);

      expect(res.body.user.email).toBe('subash@example.com');
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/session_id=/);

      // Verify last_login_at is updated
      expect(res.body.user.last_login_at).toBeDefined();
    });

    it('Failure Case: should reject with generic message on wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'subash@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('Failure Case: should reject with generic message on non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword',
        })
        .expect(401);

      expect(res.body.message).toBe('Invalid email or password.');
    });
  });

  describe('GET /auth/me & POST /auth/logout', () => {
    it('Happy Path: should fetch profile with active session and successfully log out', async () => {
      // 1. Register to obtain cookie
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'me-test@example.com',
          password: 'securepassword123',
        })
        .expect(201);

      const cookie = regRes.headers['set-cookie'];

      // 2. GET /auth/me
      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(meRes.body.user.email).toBe('me-test@example.com');
      expect(meRes.body.user.login_methods).toHaveLength(1);

      // 3. POST /auth/logout
      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      expect(logoutRes.body.message).toBe('Logged out successfully');

      // 4. Subsequent GET /auth/me fails
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('Failure Case: GET /auth/me without session cookie should return 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('Failure Case: GET /auth/me with invalid session cookie should return 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', ['session_id=fake-invalid-session-token'])
        .expect(401);
    });
  });
});
