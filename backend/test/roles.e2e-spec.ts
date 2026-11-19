import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ROLE_PRESETS } from '../src/roles/roles.presets.js';

describe('Roles (Presets, CRUD, Primary, Limits & Reordering) (e2e)', () => {
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

  describe('GET /roles/presets', () => {
    it('Happy Path: should return the preset list of roles', async () => {
      const res = await request(app.getHttpServer())
        .get('/roles/presets')
        .expect(200);

      expect(res.body.presets).toEqual([...ROLE_PRESETS]);
      expect(res.body.presets).toContain('Developer');
      expect(res.body.presets).toContain('QA Engineer');
      expect(res.body.presets).toContain('Content Creator');
    });
  });

  describe('POST /roles & Role Limits', () => {
    it('Failure Case: should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post('/roles')
        .send({ title: 'Developer' })
        .expect(401);
    });

    it('Validation: should reject title longer than 60 characters with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'roleval@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'A'.repeat(61) })
        .expect(400);

      expect(res.body.message.toString()).toContain('60');
    });

    it('Validation: should reject description longer than 200 characters with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'descval@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Developer', description: 'D'.repeat(201) })
        .expect(400);

      expect(res.body.message.toString()).toContain('200');
    });

    it('Validation: should reject duplicate role title (case-insensitive) for the same user', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'duprole@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      // Add first role
      await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Developer' })
        .expect(201);

      // Attempt duplicate with different casing
      const res = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'developer' })
        .expect(400);

      expect(res.body.message).toContain('already exists');
    });

    it('Happy Path: first role added is automatically primary and gets position 0', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'firstrole@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'QA Engineer', description: 'Quality assurance lead' })
        .expect(201);

      expect(res.body.title).toBe('QA Engineer');
      expect(res.body.description).toBe('Quality assurance lead');
      expect(res.body.is_primary).toBe(true);
      expect(res.body.position).toBe(0);
      expect(res.body.skills).toEqual([]);
    });

    it('Limit Rule: should allow up to 5 roles and reject a 6th role with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'fiveroles@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const rolesToAdd = [
        'Content Creator',
        'Developer',
        'Teacher',
        'Designer',
        'Consultant',
      ];

      for (let i = 0; i < rolesToAdd.length; i++) {
        const res = await request(app.getHttpServer())
          .post('/roles')
          .set('Cookie', cookie)
          .send({ title: rolesToAdd[i] })
          .expect(201);

        expect(res.body.position).toBe(i);
        if (i === 0) {
          expect(res.body.is_primary).toBe(true);
        } else {
          expect(res.body.is_primary).toBe(false);
        }
      }

      // Verify 5 roles in list
      const getRes = await request(app.getHttpServer())
        .get('/roles')
        .set('Cookie', cookie)
        .expect(200);
      expect(getRes.body.length).toBe(5);

      // Attempt 6th role
      const failRes = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Coach' })
        .expect(400);

      expect(failRes.body.message).toContain('at most 5 roles');
    });

    it('Primary Switch: adding subsequent role with is_primary=true demotes prior primary role', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'primaryswitch@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      // First role (primary)
      const r1 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Developer' })
        .expect(201);
      expect(r1.body.is_primary).toBe(true);

      // Second role explicitly marked primary
      const r2 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Content Creator', is_primary: true })
        .expect(201);
      expect(r2.body.is_primary).toBe(true);

      // Verify list: only r2 is primary, r1 is demoted
      const list = await request(app.getHttpServer())
        .get('/roles')
        .set('Cookie', cookie)
        .expect(200);

      const devRole = list.body.find((r: any) => r.id === r1.body.id);
      const creatorRole = list.body.find((r: any) => r.id === r2.body.id);
      expect(devRole.is_primary).toBe(false);
      expect(creatorRole.is_primary).toBe(true);
    });
  });

  describe('PATCH /roles/:id', () => {
    it('Ownership Isolation: should return 404 when user tries to update another user role', async () => {
      // User 1
      const u1 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'u1@example.com', password: 'Password123' })
        .expect(201);
      const r1 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', u1.headers['set-cookie'])
        .send({ title: 'Developer' })
        .expect(201);

      // User 2
      const u2 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'u2@example.com', password: 'Password123' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/roles/${r1.body.id}`)
        .set('Cookie', u2.headers['set-cookie'])
        .send({ title: 'Hacker' })
        .expect(404);
    });

    it('Happy Path: should update role title, description, and promote to primary', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'updaterole@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const r1 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Dev' })
        .expect(201);

      const r2 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Designer' })
        .expect(201);

      expect(r1.body.is_primary).toBe(true);
      expect(r2.body.is_primary).toBe(false);

      // Update r2 to primary and add description
      const patchRes = await request(app.getHttpServer())
        .patch(`/roles/${r2.body.id}`)
        .set('Cookie', cookie)
        .send({
          title: 'Lead Designer',
          description: 'UI/UX Lead',
          is_primary: true,
        })
        .expect(200);

      expect(patchRes.body.title).toBe('Lead Designer');
      expect(patchRes.body.description).toBe('UI/UX Lead');
      expect(patchRes.body.is_primary).toBe(true);

      // Check that r1 is no longer primary
      const list = await request(app.getHttpServer())
        .get('/roles')
        .set('Cookie', cookie)
        .expect(200);

      expect(list.body.find((r: any) => r.id === r1.body.id).is_primary).toBe(false);
      expect(list.body.find((r: any) => r.id === r2.body.id).is_primary).toBe(true);
    });
  });

  describe('DELETE /roles/:id', () => {
    it('Ownership Isolation: should reject deleting another user role with 404', async () => {
      const u1 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'delowner1@example.com', password: 'Password123' })
        .expect(201);
      const r1 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', u1.headers['set-cookie'])
        .send({ title: 'Developer' })
        .expect(201);

      const u2 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'delowner2@example.com', password: 'Password123' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/roles/${r1.body.id}`)
        .set('Cookie', u2.headers['set-cookie'])
        .expect(404);
    });

    it('Happy Path: deleting primary role auto-promotes remaining role and reindexes positions', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'delprimary@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const r1 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Role 1' })
        .expect(201);

      const r2 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Role 2' })
        .expect(201);

      const r3 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Role 3' })
        .expect(201);

      expect(r1.body.is_primary).toBe(true);

      // Attach a dummy skill to r1 to verify cascade deletion
      await prisma.skill.create({
        data: { role_id: r1.body.id, name: 'Skill 1', position: 0 },
      });

      // Delete r1 (the primary role)
      await request(app.getHttpServer())
        .delete(`/roles/${r1.body.id}`)
        .set('Cookie', cookie)
        .expect(200);

      // Skill must be deleted
      const skills = await prisma.skill.findMany({ where: { role_id: r1.body.id } });
      expect(skills.length).toBe(0);

      // Remaining roles should have r2 promoted to primary, with positions re-indexed to 0 and 1
      const list = await request(app.getHttpServer())
        .get('/roles')
        .set('Cookie', cookie)
        .expect(200);

      expect(list.body.length).toBe(2);
      expect(list.body[0].id).toBe(r2.body.id);
      expect(list.body[0].is_primary).toBe(true);
      expect(list.body[0].position).toBe(0);

      expect(list.body[1].id).toBe(r3.body.id);
      expect(list.body[1].is_primary).toBe(false);
      expect(list.body[1].position).toBe(1);
    });
  });

  describe('PUT /roles/reorder', () => {
    it('Failure Case: should reject reordering with missing IDs with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'reorderfail1@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const r1 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'R1' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'R2' })
        .expect(201);

      // Sending only one ID
      const res = await request(app.getHttpServer())
        .put('/roles/reorder')
        .set('Cookie', cookie)
        .send({ role_ids: [r1.body.id] })
        .expect(400);

      expect(res.body.message).toContain('every user role ID exactly once');
    });

    it('Failure Case: should reject reordering with duplicate IDs with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'reorderfail2@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const r1 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'R1' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .put('/roles/reorder')
        .set('Cookie', cookie)
        .send({ role_ids: [r1.body.id, r1.body.id] })
        .expect(400);

      expect(res.body.message).toContain('Duplicate role IDs');
    });

    it('Happy Path: should reorder roles and update positions sequentially', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'reorderok@example.com', password: 'Password123' })
        .expect(201);
      const cookie = regRes.headers['set-cookie'];

      const r1 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Role A' })
        .expect(201);

      const r2 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Role B' })
        .expect(201);

      const r3 = await request(app.getHttpServer())
        .post('/roles')
        .set('Cookie', cookie)
        .send({ title: 'Role C' })
        .expect(201);

      // Reverse order: r3, r2, r1
      const reordered = await request(app.getHttpServer())
        .put('/roles/reorder')
        .set('Cookie', cookie)
        .send({ role_ids: [r3.body.id, r2.body.id, r1.body.id] })
        .expect(200);

      expect(reordered.body[0].id).toBe(r3.body.id);
      expect(reordered.body[0].position).toBe(0);

      expect(reordered.body[1].id).toBe(r2.body.id);
      expect(reordered.body[1].position).toBe(1);

      expect(reordered.body[2].id).toBe(r1.body.id);
      expect(reordered.body[2].position).toBe(2);
    });
  });
});
