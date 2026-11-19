import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Public Profile, Draft/Published & Owner Preview (e2e)', () => {
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
    await prisma.$queryRaw`SELECT 1`;
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

  describe('POST /profile/me/publish & unpublish', () => {
    it('Failure Case: should reject unauthenticated publish with 401', async () => {
      await request(app.getHttpServer())
        .post('/profile/me/publish')
        .expect(401);
    });

    it('Validation: should reject publishing without a headline with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'nohead@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      // Add a role but no headline
      await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Developer' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/profile/me/publish')
        .set('Cookie', cookie)
        .expect(400);

      expect(res.body.message).toContain('headline is required');
    });

    it('Validation: should reject publishing with zero roles with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'noroles@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      // Set headline but no roles
      await request(app.getHttpServer())
        .patch('/profile/me')
        .set('Cookie', cookie)
        .send({ headline: 'Tech Lead' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/profile/me/publish')
        .set('Cookie', cookie)
        .expect(400);

      expect(res.body.message).toContain('At least one role is required');
    });

    it('Happy Path: should successfully publish when headline and at least one role exist, and unpublish', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'publishok@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      // Set headline
      await request(app.getHttpServer())
        .patch('/profile/me')
        .set('Cookie', cookie)
        .send({ headline: 'Senior QA Engineer & Content Creator' })
        .expect(200);

      // Add role
      await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'QA Engineer' })
        .expect(201);

      // Publish
      const pubRes = await request(app.getHttpServer())
        .post('/profile/me/publish')
        .set('Cookie', cookie)
        .expect(200);

      expect(pubRes.body.status).toBe('published');
      expect(pubRes.body.published_at).not.toBeNull();

      // Check DB
      const profile = await prisma.profile.findUnique({
        where: { user_id: regRes.body.user.id },
      });
      expect(profile?.status).toBe('published');

      // Unpublish
      const unpubRes = await request(app.getHttpServer())
        .post('/profile/me/unpublish')
        .set('Cookie', cookie)
        .expect(200);

      expect(unpubRes.body.status).toBe('draft');

      const profileDraft = await prisma.profile.findUnique({
        where: { user_id: regRes.body.user.id },
      });
      expect(profileDraft?.status).toBe('draft');
    });
  });

  describe('GET /public/:username', () => {
    it('Failure Case: should return 404 for non-existent username', async () => {
      await request(app.getHttpServer())
        .get('/public/nonexistentuser123')
        .expect(404);
    });

    it('Failure Case: should return 404 for reserved username', async () => {
      await request(app.getHttpServer())
        .get('/public/admin')
        .expect(404);

      await request(app.getHttpServer())
        .get('/public/api')
        .expect(404);
    });

    it('Privacy & Discovery: draft profile returns 404 to anonymous visitors and strangers', async () => {
      // Create user 1 with username "alex" (in draft status)
      const u1 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'alex@example.com', password: 'Password123' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/onboarding/complete')
        .set('Cookie', u1.headers['set-cookie'])
        .send({ name: 'Alex', username: 'alex' })
        .expect(200);

      // Anonymous stranger visits /public/alex -> 404
      await request(app.getHttpServer())
        .get('/public/alex')
        .expect(404);

      // Other registered user visits /public/alex -> 404
      const u2 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'stranger@example.com', password: 'Password123' })
        .expect(201);

      await request(app.getHttpServer())
        .get('/public/alex')
        .set('Cookie', u2.headers['set-cookie'])
        .expect(404);
    });

    it('Owner Preview: owner can preview their own draft profile with is_owner=true', async () => {
      const u1 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'ownerpreview@example.com', password: 'Password123' })
        .expect(201);
      const cookie = u1.headers['set-cookie'];

      await request(app.getHttpServer())
        .post('/onboarding/complete')
        .set('Cookie', cookie)
        .send({ name: 'Owner Person', username: 'ownerpreview' })
        .expect(200);

      // Owner requests their draft profile
      const res = await request(app.getHttpServer())
        .get('/public/ownerpreview')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.name).toBe('Owner Person');
      expect(res.body.username).toBe('ownerpreview');
      expect(res.body.status).toBe('draft');
      expect(res.body.is_owner).toBe(true);
      expect(res.body.email).toBeUndefined(); // Strict privacy
    });

    it('Happy Path: published profile is visible to all visitors with sanitized data', async () => {
      const u1 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'subash@example.com', password: 'Password123' })
        .expect(201);
      const cookie = u1.headers['set-cookie'];

      await request(app.getHttpServer())
        .post('/onboarding/complete')
        .set('Cookie', cookie)
        .send({ name: 'Subash Poudel', username: 'subash' })
        .expect(200);

      await request(app.getHttpServer())
        .patch('/profile/me')
        .set('Cookie', cookie)
        .send({
          headline: 'Lead QA & Automation Architect',
          bio: 'Passionate about robust quality systems and open-source tooling.',
          location: 'Kathmandu, Nepal',
        })
        .expect(200);

      const roleRes = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'QA Engineer', description: 'Test frameworks' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Playwright' })
        .expect(201);

      // Publish
      await request(app.getHttpServer())
        .post('/profile/me/publish')
        .set('Cookie', cookie)
        .expect(200);

      // Anonymous visitor fetches /public/subash (case-insensitive e.g. /public/SuBash)
      const res = await request(app.getHttpServer())
        .get('/public/SuBash')
        .expect(200);

      expect(res.body.name).toBe('Subash Poudel');
      expect(res.body.username).toBe('subash');
      expect(res.body.headline).toBe('Lead QA & Automation Architect');
      expect(res.body.bio).toBe('Passionate about robust quality systems and open-source tooling.');
      expect(res.body.location).toBe('Kathmandu, Nepal');
      expect(res.body.status).toBe('published');
      expect(res.body.is_owner).toBe(false);

      // Verify roles and skills
      expect(res.body.roles.length).toBe(1);
      expect(res.body.roles[0].title).toBe('QA Engineer');
      expect(res.body.roles[0].skills[0].name).toBe('Playwright');

      // Strict privacy check: email, password, and internal user ID are omitted
      expect(res.body.email).toBeUndefined();
      expect(res.body.user_id).toBeUndefined();
      expect(res.body.password_hash).toBeUndefined();
      expect(res.body.login_methods).toBeUndefined();
    });
  });
});
