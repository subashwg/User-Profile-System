import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AppleService, type AppleUserInfo } from '../src/auth/apple/apple.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Apple Sign-In, Name Capture & Linking Rule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailService: MailService;

  const mockAppleService = {
    generateAuthUrl: vi.fn(
      (state: string) =>
        `https://appleid.apple.com/auth/authorize?client_id=test&state=${state}&response_mode=form_post&scope=name%20email`,
    ),
    verifyIdToken: vi.fn(
      async (
        idToken: string,
        userPayloadRaw?: string | Record<string, any>,
      ): Promise<AppleUserInfo> => {
        if (idToken === 'token-sarah-first-time') {
          let name: string | undefined;
          if (userPayloadRaw) {
            const userObj =
              typeof userPayloadRaw === 'string'
                ? JSON.parse(userPayloadRaw)
                : userPayloadRaw;
            if (userObj?.name) {
              name = `${userObj.name.firstName} ${userObj.name.lastName}`.trim();
            }
          }
          return {
            sub: 'apple-sub-sarah-101',
            email: 'sarah.connor@privaterelay.appleid.com',
            email_verified: true,
            name,
            is_private_email: true,
          };
        }

        if (idToken === 'token-sarah-subsequent') {
          // In subsequent logins, Apple does NOT provide name in user payload
          return {
            sub: 'apple-sub-sarah-101',
            email: 'sarah.connor@privaterelay.appleid.com',
            email_verified: true,
            is_private_email: true,
          };
        }

        if (idToken === 'token-link-dave') {
          return {
            sub: 'apple-sub-dave-202',
            email: 'dave@example.com',
            email_verified: true,
            name: 'Dave Apple',
            is_private_email: false,
          };
        }

        if (idToken === 'token-unverified-eve') {
          return {
            sub: 'apple-sub-eve-303',
            email: 'eve@example.com',
            email_verified: false,
            is_private_email: false,
          };
        }

        throw new Error('Invalid Apple token');
      },
    ),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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

  describe('GET /auth/apple', () => {
    it('Happy Path: should redirect to Apple authorization endpoint and set oauth_apple_state cookie', async () => {
      const res = await request(app.getHttpServer()).get('/auth/apple').expect(302);

      expect(res.headers.location).toContain('https://appleid.apple.com/auth/authorize');
      expect(res.headers.location).toContain('response_mode=form_post');
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const stateCookie = cookies.find((c: string) => c.startsWith('oauth_apple_state='));
      expect(stateCookie).toBeDefined();
    });
  });

  describe('POST /auth/apple/callback - Security & Error handling', () => {
    it('Failure Case: should redirect with error if Apple returns error in POST body', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/apple/callback')
        .type('form')
        .send({ error: 'user_cancelled_authorize' })
        .expect(302);

      expect(res.headers.location).toContain('error=user_cancelled_authorize');
    });

    it('Failure Case: should reject when state cookie is missing or mismatched (CSRF protection)', async () => {
      // Missing cookie
      const res1 = await request(app.getHttpServer())
        .post('/auth/apple/callback')
        .type('form')
        .send({ id_token: 'valid-jwt', state: 'unknown-state' })
        .expect(302);

      expect(decodeURIComponent(res1.headers.location)).toContain('Invalid OAuth state');

      // Mismatched state
      const res2 = await request(app.getHttpServer())
        .post('/auth/apple/callback')
        .set('Cookie', ['oauth_apple_state=state-expected; Path=/'])
        .type('form')
        .send({ id_token: 'valid-jwt', state: 'state-different' })
        .expect(302);

      expect(decodeURIComponent(res2.headers.location)).toContain('Invalid OAuth state');
    });
  });

  describe('First-time Name Capture & Relay Emails', () => {
    it('Happy Path: should capture name on first sign-in and support private relay email', async () => {
      // 1. Initiate Apple flow to get state cookie
      const initRes = await request(app.getHttpServer()).get('/auth/apple');
      const stateCookieHeader = initRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('oauth_apple_state='),
      );
      const state = stateCookieHeader.split(';')[0].split('=')[1];

      // 2. Apple POST callback sending user object JSON for first-time sign-in
      const appleUserJson = JSON.stringify({
        name: { firstName: 'Sarah', lastName: 'Connor' },
      });

      const cbRes = await request(app.getHttpServer())
        .post('/auth/apple/callback')
        .set('Cookie', [stateCookieHeader])
        .type('form')
        .send({
          id_token: 'token-sarah-first-time',
          state,
          user: appleUserJson,
        })
        .expect(302);

      expect(cbRes.headers.location).not.toContain('error');

      const sessionCookieHeader = cbRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('session_id='),
      );
      expect(sessionCookieHeader).toBeDefined();

      // 3. Verify user in database and via GET /auth/me
      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [sessionCookieHeader])
        .expect(200);

      expect(meRes.body.user.name).toBe('Sarah Connor');
      expect(meRes.body.user.email).toBe('sarah.connor@privaterelay.appleid.com');
      expect(meRes.body.user.email_verified).toBe(true);
      expect(meRes.body.user.onboarding_completed).toBe(false);
      expect(meRes.body.user.login_methods).toHaveLength(1);
      expect(meRes.body.user.login_methods[0].type).toBe('apple');
    });

    it('Subsequent login: should preserve originally captured name when Apple sends no user field', async () => {
      // 1. First signup with name
      const init1 = await request(app.getHttpServer()).get('/auth/apple');
      const state1 = init1.headers['set-cookie']
        .find((c: string) => c.startsWith('oauth_apple_state='))
        .split(';')[0]
        .split('=')[1];

      await request(app.getHttpServer())
        .post('/auth/apple/callback')
        .set('Cookie', [`oauth_apple_state=${state1}`])
        .type('form')
        .send({
          id_token: 'token-sarah-first-time',
          state: state1,
          user: JSON.stringify({ name: { firstName: 'Sarah', lastName: 'Connor' } }),
        })
        .expect(302);

      // 2. Second login without user field (Apple only sends it once)
      const init2 = await request(app.getHttpServer()).get('/auth/apple');
      const state2 = init2.headers['set-cookie']
        .find((c: string) => c.startsWith('oauth_apple_state='))
        .split(';')[0]
        .split('=')[1];

      const repeatRes = await request(app.getHttpServer())
        .post('/auth/apple/callback')
        .set('Cookie', [`oauth_apple_state=${state2}`])
        .type('form')
        .send({
          id_token: 'token-sarah-subsequent',
          state: state2,
        })
        .expect(302);

      const sessionCookieHeader = repeatRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('session_id='),
      );

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [sessionCookieHeader])
        .expect(200);

      // Name remains preserved from first sign-in!
      expect(meRes.body.user.name).toBe('Sarah Connor');
    });
  });

  describe('The Linking Rule with Apple', () => {
    it('Linking Rule 1: should link Apple method to existing user with same verified email', async () => {
      // 1. Dave creates email/password account
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'dave@example.com',
          password: 'Password123',
        })
        .expect(201);

      // 2. Dave logs in via Apple with same email
      const initRes = await request(app.getHttpServer()).get('/auth/apple');
      const stateCookieHeader = initRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('oauth_apple_state='),
      );
      const state = stateCookieHeader.split(';')[0].split('=')[1];

      const cbRes = await request(app.getHttpServer())
        .post('/auth/apple/callback')
        .set('Cookie', [stateCookieHeader])
        .type('form')
        .send({
          id_token: 'token-link-dave',
          state,
        })
        .expect(302);

      const sessionCookieHeader = cbRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('session_id='),
      );
      expect(sessionCookieHeader).toBeDefined();

      // 3. Verify Dave now has 2 login methods and no duplicate user created
      const allDaves = await prisma.user.findMany({ where: { email: 'dave@example.com' } });
      expect(allDaves).toHaveLength(1);

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [sessionCookieHeader])
        .expect(200);

      expect(meRes.body.user.email).toBe('dave@example.com');
      expect(meRes.body.user.email_verified).toBe(true);
      expect(meRes.body.user.login_methods).toHaveLength(2);
      const types = meRes.body.user.login_methods.map((m: any) => m.type);
      expect(types).toContain('email');
      expect(types).toContain('apple');
    });

    it('Linking Rule 2: should reject linking if Apple email is not verified', async () => {
      // 1. Eve registers with email
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'eve@example.com',
          password: 'Password123',
        })
        .expect(201);

      // 2. Eve tries to log in with unverified Apple token
      const initRes = await request(app.getHttpServer()).get('/auth/apple');
      const stateCookieHeader = initRes.headers['set-cookie'].find((c: string) =>
        c.startsWith('oauth_apple_state='),
      );
      const state = stateCookieHeader.split(';')[0].split('=')[1];

      const cbRes = await request(app.getHttpServer())
        .post('/auth/apple/callback')
        .set('Cookie', [stateCookieHeader])
        .type('form')
        .send({
          id_token: 'token-unverified-eve',
          state,
        })
        .expect(302);

      expect(decodeURIComponent(cbRes.headers.location)).toContain('already exists');

      // Eve must not have an apple login method
      const eveInDb = await prisma.user.findUnique({
        where: { email: 'eve@example.com' },
        include: { login_methods: true },
      });
      expect(eveInDb!.login_methods).toHaveLength(1);
      expect(eveInDb!.login_methods[0].type).toBe('email');
    });
  });
});
