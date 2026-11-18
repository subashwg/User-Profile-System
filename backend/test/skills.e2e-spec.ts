import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Skills Management (Limits, Duplicates, CRUD & Reordering) (e2e)', () => {
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
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    mailService.clearLatestEmails();
    await prisma.skill.deleteMany({});
    await prisma.role.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.emailToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.loginMethod.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('POST /roles/:roleId/skills', () => {
    it('Failure Case: should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post('/roles/00000000-0000-0000-0000-000000000000/skills')
        .send({ name: 'TypeScript' })
        .expect(401);
    });

    it('Ownership Isolation: should reject adding skill to another user role with 404', async () => {
      // User 1
      const u1 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'u1skill@example.com', password: 'Password123' })
        .expect(201);
      const r1 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', u1.headers['set-cookie'])
        .send({ title: 'Developer' })
        .expect(201);

      // User 2
      const u2 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'u2skill@example.com', password: 'Password123' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/roles/${r1.body.id}/skills`)
        .set('Cookie', u2.headers['set-cookie'])
        .send({ name: 'Malicious Skill' })
        .expect(404);
    });

    it('Validation: should reject skill name longer than 40 characters with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'skillval@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const roleRes = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Developer' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'S'.repeat(41) })
        .expect(400);

      expect(res.body.message.toString()).toContain('40');
    });

    it('Validation: should reject duplicate skill name (case-insensitive) under the same role', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dupskill@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const roleRes = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'QA Engineer' })
        .expect(201);

      // Add "Playwright"
      await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Playwright' })
        .expect(201);

      // Duplicate attempt: "playwright"
      const res = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'playwright' })
        .expect(400);

      expect(res.body.message).toContain('already exists');
    });

    it('Cross-Role Independence: allows same skill name under different roles', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'crossrole@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const role1 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'QA Engineer' })
        .expect(201);

      const role2 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Developer' })
        .expect(201);

      // Add "TypeScript" to role 1
      await request(app.getHttpServer())
        .post(`/roles/${role1.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'TypeScript' })
        .expect(201);

      // Add "TypeScript" to role 2 (must succeed)
      const res = await request(app.getHttpServer())
        .post(`/roles/${role2.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'TypeScript' })
        .expect(201);

      expect(res.body.name).toBe('TypeScript');
    });

    it('Happy Path: should create skill, strip HTML tags, and assign position', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'striphtml@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const roleRes = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Developer' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: '<b>React.js</b>' })
        .expect(201);

      expect(res.body.name).toBe('React.js');
      expect(res.body.position).toBe(0);
      expect(res.body.role_id).toBe(roleRes.body.id);
    });

    it('Limit Rule: should allow up to 15 skills per role and reject 16th with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'fifteenskills@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const roleRes = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Tech Stack' })
        .expect(201);

      for (let i = 1; i <= 15; i++) {
        const res = await request(app.getHttpServer())
          .post(`/roles/${roleRes.body.id}/skills`)
          .set('Cookie', cookie)
          .send({ name: `Skill ${i}` })
          .expect(201);

        expect(res.body.position).toBe(i - 1);
      }

      // Verify 15 skills count
      const list = await request(app.getHttpServer())
        .get(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .expect(200);
      expect(list.body.length).toBe(15);

      // Attempt 16th skill
      const failRes = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Skill 16' })
        .expect(400);

      expect(failRes.body.message).toContain('at most 15 skills');
    });
  });

  describe('DELETE /roles/:roleId/skills/:skillId', () => {
    it('Happy Path: should delete skill and re-index remaining positions', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'delskill@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const roleRes = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'QA Engineer' })
        .expect(201);

      const s1 = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Skill A' })
        .expect(201);

      const s2 = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Skill B' })
        .expect(201);

      const s3 = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Skill C' })
        .expect(201);

      // Delete s1 (first skill)
      await request(app.getHttpServer())
        .delete(`/roles/${roleRes.body.id}/skills/${s1.body.id}`)
        .set('Cookie', cookie)
        .expect(200);

      // Fetch remaining skills
      const list = await request(app.getHttpServer())
        .get(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .expect(200);

      expect(list.body.length).toBe(2);
      expect(list.body[0].id).toBe(s2.body.id);
      expect(list.body[0].position).toBe(0);

      expect(list.body[1].id).toBe(s3.body.id);
      expect(list.body[1].position).toBe(1);
    });
  });

  describe('PUT /roles/:roleId/skills/reorder', () => {
    it('Failure Case: should reject reordering with missing or duplicate IDs with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'reorderskillfail@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const roleRes = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Dev' })
        .expect(201);

      const s1 = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Skill 1' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Skill 2' })
        .expect(201);

      // Sending duplicate IDs
      await request(app.getHttpServer())
        .put(`/roles/${roleRes.body.id}/skills/reorder`)
        .set('Cookie', cookie)
        .send({ skill_ids: [s1.body.id, s1.body.id] })
        .expect(400);

      // Sending only 1 ID
      await request(app.getHttpServer())
        .put(`/roles/${roleRes.body.id}/skills/reorder`)
        .set('Cookie', cookie)
        .send({ skill_ids: [s1.body.id] })
        .expect(400);
    });

    it('Happy Path: should reorder skills within role and update positions', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'reorderskillok@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const roleRes = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Dev' })
        .expect(201);

      const s1 = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Skill 1' })
        .expect(201);

      const s2 = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Skill 2' })
        .expect(201);

      const s3 = await request(app.getHttpServer())
        .post(`/roles/${roleRes.body.id}/skills`)
        .set('Cookie', cookie)
        .send({ name: 'Skill 3' })
        .expect(201);

      // Reverse order: s3, s2, s1
      const reordered = await request(app.getHttpServer())
        .put(`/roles/${roleRes.body.id}/skills/reorder`)
        .set('Cookie', cookie)
        .send({ skill_ids: [s3.body.id, s2.body.id, s1.body.id] })
        .expect(200);

      expect(reordered.body[0].id).toBe(s3.body.id);
      expect(reordered.body[0].position).toBe(0);

      expect(reordered.body[1].id).toBe(s2.body.id);
      expect(reordered.body[1].position).toBe(1);

      expect(reordered.body[2].id).toBe(s1.body.id);
      expect(reordered.body[2].position).toBe(2);
    });
  });
});
