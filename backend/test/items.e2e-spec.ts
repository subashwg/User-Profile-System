import crypto from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CoverSource, PortfolioItemKind } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Items (CRUD, Grouping, Limits & Constraints) (e2e)', () => {
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
    await app.listen(0);
    prisma = app.get(PrismaService);
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.portfolioItem.deleteMany(),
      prisma.skill.deleteMany(),
      prisma.role.deleteMany(),
      prisma.profile.deleteMany(),
      prisma.emailToken.deleteMany(),
      prisma.session.deleteMany(),
      prisma.loginMethod.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  async function createAuthenticatedUser(email = 'user@example.com') {
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Portfolio User',
        username: email.split('@')[0],
        email_verified: true,
      },
    });

    const sessionId = crypto.randomUUID();
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        user_id: user.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return { user, sessionCookie: `session_id=${sessionId}` };
  }

  describe('POST /items', () => {
    it('Happy path: creates an item and returns 201', async () => {
      const { user, sessionCookie } = await createAuthenticatedUser('create@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Engineer', is_primary: true },
      });

      const res = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: role.id,
          kind: 'video',
          title: 'My Architecture Video',
          description: 'A walkthrough of our system',
          url: 'https://youtube.com/watch?v=12345',
          is_featured: true,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('My Architecture Video');
      expect(res.body.source_site).toBe('YouTube');
      expect(res.body.position).toBe(0);
      expect(res.body.is_featured).toBe(true);
      expect(res.body.role.title).toBe('Engineer');
    });

    it('Failure: requires authentication (401)', async () => {
      await request(app.getHttpServer())
        .post('/items')
        .send({
          role_id: 'd9b2d63d-a233-4f9e-9d29-165c792f4477',
          kind: 'project',
          title: 'Unauth Item',
          url: 'https://github.com/project',
        })
        .expect(401);
    });

    it('Failure: rejects invalid URLs or non-http/https protocols (400)', async () => {
      const { user, sessionCookie } = await createAuthenticatedUser('urlfail@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Dev', is_primary: true },
      });

      await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: role.id,
          kind: 'project',
          title: 'Bad URL',
          url: 'javascript:alert(1)',
        })
        .expect(400);
    });

    it('Failure: rejects title longer than 100 characters (400)', async () => {
      const { user, sessionCookie } = await createAuthenticatedUser('titlefail@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Dev', is_primary: true },
      });

      await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: role.id,
          kind: 'article',
          title: 'A'.repeat(101),
          url: 'https://example.com/article',
        })
        .expect(400);
    });

    it('Failure: rejects creating item under role of another user (404)', async () => {
      const { sessionCookie } = await createAuthenticatedUser('userA@example.com');
      const { user: otherUser } = await createAuthenticatedUser('userB@example.com');
      const otherRole = await prisma.role.create({
        data: { user_id: otherUser.id, title: 'Other Role', is_primary: true },
      });

      await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: otherRole.id,
          kind: 'article',
          title: 'Stealing Role',
          url: 'https://example.com/item',
        })
        .expect(404);
    });

    it('Failure: rejects duplicate links per user (400)', async () => {
      const { user, sessionCookie } = await createAuthenticatedUser('dup@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Dev', is_primary: true },
      });

      await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: role.id,
          kind: 'project',
          title: 'Project 1',
          url: 'https://github.com/org/repo',
        })
        .expect(201);

      // Attempt duplicate with trailing slash and query params
      const res = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: role.id,
          kind: 'project',
          title: 'Project 2',
          url: 'https://github.com/org/repo/?utm_source=twitter',
        })
        .expect(400);

      expect(res.body.message).toContain('already exists');
    });
  });

  describe('GET /items', () => {
    it('Happy path: lists items grouped under roles', async () => {
      const { user, sessionCookie } = await createAuthenticatedUser('list@example.com');
      const role1 = await prisma.role.create({
        data: { user_id: user.id, title: 'Role 1', position: 0 },
      });
      const role2 = await prisma.role.create({
        data: { user_id: user.id, title: 'Role 2', position: 1 },
      });

      await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: role1.id,
          kind: 'project',
          title: 'Item in Role 1',
          url: 'https://github.com/1',
        });

      await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: role2.id,
          kind: 'article',
          title: 'Item in Role 2',
          url: 'https://medium.com/2',
          is_hidden: true,
        });

      const res = await request(app.getHttpServer())
        .get('/items')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].role.title).toBe('Role 1');
      expect(res.body[0].items).toHaveLength(1);
      expect(res.body[1].role.title).toBe('Role 2');
      expect(res.body[1].items).toHaveLength(1);
      expect(res.body[1].items[0].is_hidden).toBe(true);
    });

    it('Happy path: flat=true returns flat array of items', async () => {
      const { user, sessionCookie } = await createAuthenticatedUser('flat@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Role', is_primary: true },
      });

      await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: role.id,
          kind: 'project',
          title: 'Flat Item',
          url: 'https://github.com/flat',
        });

      const res = await request(app.getHttpServer())
        .get('/items?flat=true')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Flat Item');
      expect(res.body[0].role.title).toBe('Role');
    });
  });

  describe('GET /items/:id', () => {
    it('Happy path: returns single item for owner', async () => {
      const { user, sessionCookie } = await createAuthenticatedUser('singleowner@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Role', is_primary: true },
      });

      const created = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: role.id,
          kind: 'project',
          title: 'Single Item',
          url: 'https://github.com/single',
        });

      const res = await request(app.getHttpServer())
        .get(`/items/${created.body.id}`)
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body.id).toBe(created.body.id);
      expect(res.body.title).toBe('Single Item');
    });

    it('Failure: returns 404 for stranger', async () => {
      const { user: userA, sessionCookie: cookieA } = await createAuthenticatedUser('a@example.com');
      const { sessionCookie: cookieB } = await createAuthenticatedUser('b@example.com');
      const role = await prisma.role.create({
        data: { user_id: userA.id, title: 'Role', is_primary: true },
      });

      const created = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', cookieA)
        .send({
          role_id: role.id,
          kind: 'project',
          title: 'Secret Item',
          url: 'https://github.com/secret',
        });

      await request(app.getHttpServer())
        .get(`/items/${created.body.id}`)
        .set('Cookie', cookieB)
        .expect(404);
    });
  });

  describe('PATCH /items/:id', () => {
    it('Happy path: edits title and toggles featured/hidden', async () => {
      const { user, sessionCookie } = await createAuthenticatedUser('patch@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Role', is_primary: true },
      });

      const created = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({
          role_id: role.id,
          kind: 'course',
          title: 'Initial Course Title',
          url: 'https://example.com/course',
        });

      const res = await request(app.getHttpServer())
        .patch(`/items/${created.body.id}`)
        .set('Cookie', sessionCookie)
        .send({
          title: 'Updated Course Title',
          is_featured: true,
          is_hidden: true,
        })
        .expect(200);

      expect(res.body.title).toBe('Updated Course Title');
      expect(res.body.is_featured).toBe(true);
      expect(res.body.is_hidden).toBe(true);
    });

    it('Happy path: moves item to another role at end position', async () => {
      const { user, sessionCookie } = await createAuthenticatedUser('movehttp@example.com');
      const roleA = await prisma.role.create({
        data: { user_id: user.id, title: 'Role A', position: 0 },
      });
      const roleB = await prisma.role.create({
        data: { user_id: user.id, title: 'Role B', position: 1 },
      });

      const itemA1 = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({ role_id: roleA.id, kind: 'project', title: 'Item A1', url: 'https://a.com/1' });
      const itemA2 = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({ role_id: roleA.id, kind: 'project', title: 'Item A2', url: 'https://a.com/2' });
      const itemB1 = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({ role_id: roleB.id, kind: 'project', title: 'Item B1', url: 'https://b.com/1' });

      // Move Item A1 to Role B
      const moved = await request(app.getHttpServer())
        .patch(`/items/${itemA1.body.id}`)
        .set('Cookie', sessionCookie)
        .send({ role_id: roleB.id })
        .expect(200);

      expect(moved.body.role_id).toBe(roleB.id);
      expect(moved.body.position).toBe(1); // after itemB1 (position 0)

      // Verify A2 is re-indexed to position 0 in Role A
      const a2 = await request(app.getHttpServer())
        .get(`/items/${itemA2.body.id}`)
        .set('Cookie', sessionCookie);
      expect(a2.body.position).toBe(0);
    });
  });

  describe('DELETE /items/:id', () => {
    it('Happy path: deletes item and re-indexes remaining', async () => {
      const { user, sessionCookie } = await createAuthenticatedUser('delhttp@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Role', is_primary: true },
      });

      const i0 = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({ role_id: role.id, kind: 'other', title: 'I0', url: 'https://i.com/0' });
      const i1 = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({ role_id: role.id, kind: 'other', title: 'I1', url: 'https://i.com/1' });
      const i2 = await request(app.getHttpServer())
        .post('/items')
        .set('Cookie', sessionCookie)
        .send({ role_id: role.id, kind: 'other', title: 'I2', url: 'https://i.com/2' });

      await request(app.getHttpServer())
        .delete(`/items/${i1.body.id}`)
        .set('Cookie', sessionCookie)
        .expect(200);

      // Verify i1 is gone (404)
      await request(app.getHttpServer())
        .get(`/items/${i1.body.id}`)
        .set('Cookie', sessionCookie)
        .expect(404);

      // Verify i2 is now position 1
      const i2After = await request(app.getHttpServer())
        .get(`/items/${i2.body.id}`)
        .set('Cookie', sessionCookie);
      expect(i2After.body.position).toBe(1);
    });
  });
});
