import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Onboarding Roles & "What do you do?" Step (e2e)', () => {
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

  describe('POST /onboarding/roles', () => {
    it('Failure Case: should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post('/onboarding/roles')
        .send({ roles: [{ title: 'Developer' }] })
        .expect(401);
    });

    it('Validation: should reject payload with more than 5 roles with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'onboardroles1@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/onboarding/roles')
        .set('Cookie', cookie)
        .send({
          roles: [
            { title: 'Role 1' },
            { title: 'Role 2' },
            { title: 'Role 3' },
            { title: 'Role 4' },
            { title: 'Role 5' },
            { title: 'Role 6' },
          ],
        })
        .expect(400);

      expect(res.body.message.toString()).toContain('5');
    });

    it('Validation: should reject duplicate role titles (case-insensitive) with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'onboardduproles@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/onboarding/roles')
        .set('Cookie', cookie)
        .send({
          roles: [
            { title: 'Developer' },
            { title: 'developer' },
          ],
        })
        .expect(400);

      expect(res.body.message).toContain('Duplicate role title');
    });

    it('Happy Path (Skip): should allow skipping roles with empty array and create Profile', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'skiponboard@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];
      const userId = regRes.body.user.id;

      const res = await request(app.getHttpServer())
        .post('/onboarding/roles')
        .set('Cookie', cookie)
        .send({ roles: [] })
        .expect(200);

      expect(res.body.roles).toEqual([]);
      expect(res.body.user.onboarding_completed).toBe(true);

      // Verify Profile record exists for user in DB
      const profile = await prisma.profile.findUnique({
        where: { user_id: userId },
      });
      expect(profile).not.toBeNull();
      expect(profile?.status).toBe('draft');
    });

    it('Happy Path (Save Roles): should save selected roles, set primary, and assign positions', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'pickerroles@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];
      const userId = regRes.body.user.id;

      const res = await request(app.getHttpServer())
        .post('/onboarding/roles')
        .set('Cookie', cookie)
        .send({
          roles: [
            { title: 'QA Engineer', description: 'Test automation specialist' },
            { title: 'Content Creator', is_primary: true },
            { title: 'Writer' },
          ],
        })
        .expect(200);

      expect(res.body.roles.length).toBe(3);
      expect(res.body.user.onboarding_completed).toBe(true);

      // Verify roles ordering and primary status
      expect(res.body.roles[0].title).toBe('QA Engineer');
      expect(res.body.roles[0].position).toBe(0);
      expect(res.body.roles[0].is_primary).toBe(false);

      expect(res.body.roles[1].title).toBe('Content Creator');
      expect(res.body.roles[1].position).toBe(1);
      expect(res.body.roles[1].is_primary).toBe(true);

      expect(res.body.roles[2].title).toBe('Writer');
      expect(res.body.roles[2].position).toBe(2);
      expect(res.body.roles[2].is_primary).toBe(false);

      // Verify database state
      const rolesInDb = await prisma.role.findMany({
        where: { user_id: userId },
        orderBy: { position: 'asc' },
      });
      expect(rolesInDb.length).toBe(3);
      expect(rolesInDb[1].is_primary).toBe(true);

      const profile = await prisma.profile.findUnique({
        where: { user_id: userId },
      });
      expect(profile).not.toBeNull();
    });
  });
});
