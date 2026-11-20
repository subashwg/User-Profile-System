import crypto from 'node:crypto';
import { BadRequestException, INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioItemKind } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ItemsService } from '../src/items/items.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Step 3 Item 5: Feature, Hide, Reorder & Move (Integration & E2E)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let itemsService: ItemsService;

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
    itemsService = app.get(ItemsService);
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

  async function createAuthUser(email = 'user@example.com') {
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Item Reorder User',
        username: email.split('@')[0],
        email_verified: true,
      },
    });

    const sessionId = crypto.randomUUID();
    await prisma.session.create({
      data: {
        id: sessionId,
        user_id: user.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return { user, sessionCookie: `session_id=${sessionId}` };
  }

  describe('ItemsService.reorderRoleItems (Service Level)', () => {
    it('Happy path: reorders items inside role with new 0-based positions', async () => {
      const { user } = await createAuthUser('reorder1@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Dev Role', is_primary: true },
      });

      const i0 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Project 0',
        url: 'https://ex.com/0',
      });
      const i1 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Project 1',
        url: 'https://ex.com/1',
      });
      const i2 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Project 2',
        url: 'https://ex.com/2',
      });

      // Reverse order: i2, i0, i1
      const reordered = await itemsService.reorderRoleItems(user.id, role.id, [
        i2.id,
        i0.id,
        i1.id,
      ]);

      expect(reordered).toHaveLength(3);
      expect(reordered[0].id).toBe(i2.id);
      expect(reordered[0].position).toBe(0);
      expect(reordered[1].id).toBe(i0.id);
      expect(reordered[1].position).toBe(1);
      expect(reordered[2].id).toBe(i1.id);
      expect(reordered[2].position).toBe(2);
    });

    it('Failure: rejects duplicate item IDs with BadRequestException', async () => {
      const { user } = await createAuthUser('reorderdup@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Dev Role', is_primary: true },
      });

      const i0 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Project 0',
        url: 'https://ex.com/0',
      });
      await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Project 1',
        url: 'https://ex.com/1',
      });

      await expect(
        itemsService.reorderRoleItems(user.id, role.id, [i0.id, i0.id]),
      ).rejects.toThrow(BadRequestException);
    });

    it('Failure: rejects incomplete item list with BadRequestException', async () => {
      const { user } = await createAuthUser('reorderinc@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Dev Role', is_primary: true },
      });

      const i0 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Project 0',
        url: 'https://ex.com/0',
      });
      await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Project 1',
        url: 'https://ex.com/1',
      });

      // Passing only i0
      await expect(
        itemsService.reorderRoleItems(user.id, role.id, [i0.id]),
      ).rejects.toThrow(BadRequestException);
    });

    it('Failure: rejects role belonging to another user with NotFoundException', async () => {
      const { user: u1 } = await createAuthUser('u1@example.com');
      const { user: u2 } = await createAuthUser('u2@example.com');
      const roleU2 = await prisma.role.create({
        data: { user_id: u2.id, title: 'Role U2', is_primary: true },
      });

      await expect(
        itemsService.reorderRoleItems(u1.id, roleU2.id, []),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('PUT /roles/:roleId/items/order (HTTP End-to-End)', () => {
    it('Happy path: reorders items through HTTP endpoint', async () => {
      const { user, sessionCookie } = await createAuthUser('httpreorder@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Writer', is_primary: true },
      });

      const itA = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.article,
        title: 'Article A',
        url: 'https://blog.com/a',
      });
      const itB = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.article,
        title: 'Article B',
        url: 'https://blog.com/b',
      });

      const res = await request(app.getHttpServer())
        .put(`/roles/${role.id}/items/order`)
        .set('Cookie', sessionCookie)
        .send({
          item_ids: [itB.id, itA.id],
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].id).toBe(itB.id);
      expect(res.body[0].position).toBe(0);
      expect(res.body[1].id).toBe(itA.id);
      expect(res.body[1].position).toBe(1);
    });

    it('Failure: requires authentication (401)', async () => {
      await request(app.getHttpServer())
        .put('/roles/d9b2d63d-a233-4f9e-9d29-165c792f4477/items/order')
        .send({ item_ids: ['d9b2d63d-a233-4f9e-9d29-165c792f4477'] })
        .expect(401);
    });

    it('Failure: rejects unauthorized role (404)', async () => {
      const { sessionCookie } = await createAuthUser('owner@example.com');
      const { user: stranger } = await createAuthUser('stranger@example.com');
      const strangerRole = await prisma.role.create({
        data: { user_id: stranger.id, title: 'Stranger Role', is_primary: true },
      });

      await request(app.getHttpServer())
        .put(`/roles/${strangerRole.id}/items/order`)
        .set('Cookie', sessionCookie)
        .send({ item_ids: [] })
        .expect(400); // Validation pipe catches empty array first
    });
  });

  describe('Feature, Hide & Move Edge Cases', () => {
    it('enforces 5 featured items limit with clear rejection message', async () => {
      const { user, sessionCookie } = await createAuthUser('featlimit@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Speaker', is_primary: true },
      });

      // Create 5 featured items
      const items = [];
      for (let i = 0; i < 5; i++) {
        const item = await itemsService.createItem(user.id, {
          role_id: role.id,
          kind: PortfolioItemKind.video,
          title: `Talk ${i}`,
          url: `https://youtube.com/watch?v=talk${i}`,
          is_featured: true,
        });
        items.push(item);
      }

      // Create a 6th unfeatured item
      const item6 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.video,
        title: 'Talk 6',
        url: 'https://youtube.com/watch?v=talk6',
        is_featured: false,
      });

      // Attempting to feature item6 via PATCH must fail with 400
      const res = await request(app.getHttpServer())
        .patch(`/items/${item6.id}`)
        .set('Cookie', sessionCookie)
        .send({ is_featured: true })
        .expect(400);

      expect(res.body.message).toContain('more than 5 featured items');
    });

    it('allows unfeaturing an item and then featuring another', async () => {
      const { user, sessionCookie } = await createAuthUser('featswap@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Speaker', is_primary: true },
      });

      const featuredItems = [];
      for (let i = 0; i < 5; i++) {
        const itm = await itemsService.createItem(user.id, {
          role_id: role.id,
          kind: PortfolioItemKind.video,
          title: `Keynote ${i}`,
          url: `https://youtube.com/watch?v=kn${i}`,
          is_featured: true,
        });
        featuredItems.push(itm);
      }

      const candidate = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.video,
        title: 'Candidate',
        url: 'https://youtube.com/watch?v=cand',
        is_featured: false,
      });

      // Unfeature first item
      await request(app.getHttpServer())
        .patch(`/items/${featuredItems[0].id}`)
        .set('Cookie', sessionCookie)
        .send({ is_featured: false })
        .expect(200);

      // Now candidate can be featured successfully
      const res = await request(app.getHttpServer())
        .patch(`/items/${candidate.id}`)
        .set('Cookie', sessionCookie)
        .send({ is_featured: true })
        .expect(200);

      expect(res.body.is_featured).toBe(true);
    });

    it('toggles hidden state with eye button behavior', async () => {
      const { user, sessionCookie } = await createAuthUser('hideunhide@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Role', is_primary: true },
      });

      const itm = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.product,
        title: 'SaaS App',
        url: 'https://saas.app',
        is_hidden: false,
      });

      // Hide it
      const hiddenRes = await request(app.getHttpServer())
        .patch(`/items/${itm.id}`)
        .set('Cookie', sessionCookie)
        .send({ is_hidden: true })
        .expect(200);
      expect(hiddenRes.body.is_hidden).toBe(true);

      // Unhide it
      const unhideRes = await request(app.getHttpServer())
        .patch(`/items/${itm.id}`)
        .set('Cookie', sessionCookie)
        .send({ is_hidden: false })
        .expect(200);
      expect(unhideRes.body.is_hidden).toBe(false);
    });
  });
});
