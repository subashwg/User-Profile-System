import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { GoogleService, type GoogleUserInfo } from '../src/auth/google/google.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Google OAuth & Linking Rule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailService: MailService;

  const mockGoogleService = {
    generateAuthUrl: vi.fn((state: string) => `https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=${state}`),
    verifyCodeAndGetUserInfo: vi.fn(async (code: string): Promise<GoogleUserInfo> => {
      if (code === 'code-new-user') {
        return {
          sub: 'google-sub-new-123',
          email: 'new-google-user@example.com',
          email_verified: true,
          name: 'Google Newcomer',
          picture: 'https://example.com/avatar.jpg',
        };
      }
      if (code === 'code-link-existing-verified') {
        return {
          sub: 'google-sub-bob-456',
          email: 'bob@example.com',
          email_verified: true,
          name: 'Bob via Google',
          picture: 'https://example.com/bob.jpg',
        };
      }
      if (code === 'code-unverified-email') {
        return {
          sub: 'google-sub-unverified-789',
          email: 'carol@example.com',
          email_verified: false,
        };
      }
      if (code === 'code-repeat-login') {
        return {
          sub: 'google-sub-new-123',
          email: 'new-google-user@example.com',
          email_verified: true,
        };
      }
      throw new Error('Google token exchange failed');
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleService)
      .useValue(mockGoogleService)
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

  describe('GET /auth/google', () => {
    it('Happy Path: should redirect to Google OAuth URL and set oauth_google_state cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/google')
        .expect(302);

      expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const stateCookie = cookies.find((c: string) => c.startsWith('oauth_google_state='));
      expect(stateCookie).toBeDefined();
    });
  });

  describe('GET /auth/google/callback - Security & Error handling', () => {
    it('Failure Case: should redirect with error if Google returns error param', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/google/callback?error=access_denied')
        .expect(302);

      expect(res.headers.location).toContain('error=access_denied');
    });

    it('Failure Case: should redirect with error if state cookie is missing or mismatched (CSRF protection)', async () => {
      // Missing cookie
      const res1 = await request(app.getHttpServer())
        .get('/auth/google/callback?code=some-code&state=fake-state')
        .expect(302);

      expect(res1.headers.location).toContain('error=');
      expect(decodeURIComponent(res1.headers.location)).toContain('Invalid OAuth state');

      // Mismatched state
      const res2 = await request(app.getHttpServer())
        .get('/auth/google/callback?code=some-code&state=state-a')
        .set('Cookie', ['oauth_google_state=state-b; Path=/'])
        .expect(302);

      expect(res2.headers.location).toContain('error=');
      expect(decodeURIComponent(res2.headers.location)).toContain('Invalid OAuth state');
    });
  });

  describe('The Linking Rule & Full Login Flows', () => {
    it('Linking Rule 3: should create a new user and login method when email does not exist, and prompt onboarding', async () => {
      // 1. Initiate Google flow to get state cookie
      const initRes = await request(app.getHttpServer()).get('/auth/google');
      const stateCookieHeader = initRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('oauth_google_state='),
      );
      const state = stateCookieHeader.split(';')[0].split('=')[1];

      // 2. Callback with valid state and code for brand new user
      const cbRes = await request(app.getHttpServer())
        .get(`/auth/google/callback?code=code-new-user&state=${state}`)
        .set('Cookie', [stateCookieHeader])
        .expect(302);

      // Successfully redirected to frontend
      expect(cbRes.headers.location).not.toContain('error');

      // Receives session cookie
      const sessionCookieHeader = cbRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('session_id='),
      );
      expect(sessionCookieHeader).toBeDefined();

      // 3. User verification via GET /auth/me
      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [sessionCookieHeader])
        .expect(200);

      expect(meRes.body.user.email).toBe('new-google-user@example.com');
      expect(meRes.body.user.name).toBe('Google Newcomer');
      expect(meRes.body.user.avatar_url).toBe('https://example.com/avatar.jpg');
      expect(meRes.body.user.email_verified).toBe(true);
      expect(meRes.body.user.onboarding_completed).toBe(false);
      expect(meRes.body.user.login_methods).toHaveLength(1);
      expect(meRes.body.user.login_methods[0].type).toBe('google');
    });

    it('Linking Rule 1: should link Google method to existing user if email matches and is verified', async () => {
      // 1. Bob creates account with email & password first
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'bob@example.com',
          password: 'Password123',
        })
        .expect(201);

      // Verify Bob currently has only email login method
      const bobInDb = await prisma.user.findUnique({
        where: { email: 'bob@example.com' },
        include: { login_methods: true },
      });
      expect(bobInDb).toBeDefined();
      expect(bobInDb!.email_verified).toBe(false);
      expect(bobInDb!.login_methods).toHaveLength(1);
      expect(bobInDb!.login_methods[0].type).toBe('email');

      // 2. Bob logs in via Google with the same email, verified by Google
      const initRes = await request(app.getHttpServer()).get('/auth/google');
      const stateCookieHeader = initRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('oauth_google_state='),
      );
      const state = stateCookieHeader.split(';')[0].split('=')[1];

      const cbRes = await request(app.getHttpServer())
        .get(`/auth/google/callback?code=code-link-existing-verified&state=${state}`)
        .set('Cookie', [stateCookieHeader])
        .expect(302);

      const sessionCookieHeader = cbRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('session_id='),
      );
      expect(sessionCookieHeader).toBeDefined();

      // 3. Check that NO duplicate user was created, and Bob now has 2 login methods
      const allUsers = await prisma.user.findMany({ where: { email: 'bob@example.com' } });
      expect(allUsers).toHaveLength(1); // No duplicate!

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [sessionCookieHeader])
        .expect(200);

      expect(meRes.body.user.id).toBe(bobInDb!.id);
      expect(meRes.body.user.email).toBe('bob@example.com');
      expect(meRes.body.user.email_verified).toBe(true); // Confirmed by Google
      expect(meRes.body.user.login_methods).toHaveLength(2);
      const methodTypes = meRes.body.user.login_methods.map((m: any) => m.type);
      expect(methodTypes).toContain('email');
      expect(methodTypes).toContain('google');
    });

    it('Linking Rule 2: should reject linking if email exists but Google does not confirm email is verified', async () => {
      // 1. Carol registers with email
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'carol@example.com',
          password: 'Password123',
        })
        .expect(201);

      // 2. Carol tries to login with unverified Google email
      const initRes = await request(app.getHttpServer()).get('/auth/google');
      const stateCookieHeader = initRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('oauth_google_state='),
      );
      const state = stateCookieHeader.split(';')[0].split('=')[1];

      const cbRes = await request(app.getHttpServer())
        .get(`/auth/google/callback?code=code-unverified-email&state=${state}`)
        .set('Cookie', [stateCookieHeader])
        .expect(302);

      // Must redirect to error
      expect(cbRes.headers.location).toContain('error=');
      expect(decodeURIComponent(cbRes.headers.location)).toContain('already exists');

      // Carol must NOT have a google login method
      const carolInDb = await prisma.user.findUnique({
        where: { email: 'carol@example.com' },
        include: { login_methods: true },
      });
      expect(carolInDb!.login_methods).toHaveLength(1);
      expect(carolInDb!.login_methods[0].type).toBe('email');
    });

    it('Subsequent Google login: should log in existing Google user directly', async () => {
      // 1. Initial Google signup
      const initRes1 = await request(app.getHttpServer()).get('/auth/google');
      const state1 = initRes1.headers['set-cookie']
        .find((c: string) => c.startsWith('oauth_google_state='))
        .split(';')[0]
        .split('=')[1];

      await request(app.getHttpServer())
        .get(`/auth/google/callback?code=code-new-user&state=${state1}`)
        .set('Cookie', [`oauth_google_state=${state1}`])
        .expect(302);

      // 2. Repeat Google login
      const initRes2 = await request(app.getHttpServer()).get('/auth/google');
      const state2 = initRes2.headers['set-cookie']
        .find((c: string) => c.startsWith('oauth_google_state='))
        .split(';')[0]
        .split('=')[1];

      const repeatRes = await request(app.getHttpServer())
        .get(`/auth/google/callback?code=code-repeat-login&state=${state2}`)
        .set('Cookie', [`oauth_google_state=${state2}`])
        .expect(302);

      const sessionCookieHeader = repeatRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('session_id='),
      );
      expect(sessionCookieHeader).toBeDefined();

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [sessionCookieHeader])
        .expect(200);

      expect(meRes.body.user.email).toBe('new-google-user@example.com');
      expect(meRes.body.user.login_methods).toHaveLength(1);
    });
  });
});
