import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Profile Basics (GET & PATCH /profile/me) (e2e)', () => {
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

  describe('GET /profile/me', () => {
    it('Failure Case: should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/profile/me').expect(401);
    });

    it('Happy Path: should return current user profile and auto-create if not existing', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'prof-test@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .get('/profile/me')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body.user_id).toBe(regRes.body.user.id);
      expect(res.body.status).toBe('draft');
      expect(res.body.headline).toBeNull();
      expect(res.body.bio).toBeNull();
      expect(res.body.location).toBeNull();
      expect(res.body.roles).toEqual([]);
    });
  });

  describe('PATCH /profile/me', () => {
    it('Failure Case: should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .patch('/profile/me')
        .send({ headline: 'New Headline' })
        .expect(401);
    });

    it('Validation: should reject headline longer than 120 characters', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'long-head@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .patch('/profile/me')
        .set('Cookie', sessionCookie)
        .send({
          headline: 'A'.repeat(121),
        })
        .expect(400);

      expect(res.body.message).toContain('Headline must be at most 120 characters');
    });

    it('Validation: should reject bio longer than 500 characters', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'long-bio@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .patch('/profile/me')
        .set('Cookie', sessionCookie)
        .send({
          bio: 'B'.repeat(501),
        })
        .expect(400);

      expect(res.body.message).toContain('Bio must be at most 500 characters');
    });

    it('Validation: should reject location longer than 80 characters', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'long-loc@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .patch('/profile/me')
        .set('Cookie', sessionCookie)
        .send({
          location: 'C'.repeat(81),
        })
        .expect(400);

      expect(res.body.message).toContain('Location must be at most 80 characters');
    });

    it('Happy Path: should update headline, bio, location and strip HTML tags', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'update-prof@example.com',
          password: 'Password123',
        })
        .expect(201);

      const sessionCookie = regRes.headers['set-cookie'];

      const updateRes = await request(app.getHttpServer())
        .patch('/profile/me')
        .set('Cookie', sessionCookie)
        .send({
          headline: '<b>Lead Developer</b> & Educator',
          bio: '<script>alert("hack")</script>Passionate about building intuitive software.',
          location: 'Kathmandu, Nepal',
        })
        .expect(200);

      // HTML stripped and text trimmed
      expect(updateRes.body.headline).toBe('Lead Developer & Educator');
      expect(updateRes.body.bio).toBe('alert("hack")Passionate about building intuitive software.');
      expect(updateRes.body.location).toBe('Kathmandu, Nepal');

      // Verify GET /profile/me reflects update
      const getRes = await request(app.getHttpServer())
        .get('/profile/me')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(getRes.body.headline).toBe('Lead Developer & Educator');
      expect(getRes.body.bio).toBe('alert("hack")Passionate about building intuitive software.');
      expect(getRes.body.location).toBe('Kathmandu, Nepal');
    });

    it('Ownership Isolation: updating one user profile must not affect another user', async () => {
      // User 1
      const user1 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user1@example.com', password: 'Password123' });
      const cookie1 = user1.headers['set-cookie'];

      // User 2
      const user2 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user2@example.com', password: 'Password123' });
      const cookie2 = user2.headers['set-cookie'];

      // User 1 updates profile
      await request(app.getHttpServer())
        .patch('/profile/me')
        .set('Cookie', cookie1)
        .send({ headline: 'User 1 Headline', location: 'Tokyo' })
        .expect(200);

      // User 2 fetches profile - must be untouched
      const res2 = await request(app.getHttpServer())
        .get('/profile/me')
        .set('Cookie', cookie2)
        .expect(200);

      expect(res2.body.headline).toBeNull();
      expect(res2.body.location).toBeNull();
    });
  });
});
