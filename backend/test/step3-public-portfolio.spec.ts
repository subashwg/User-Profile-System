import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PortfolioItemKind } from '@prisma/client';

describe('Step 3 Item 9: Public Portfolio & Items API', () => {
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
      prisma.session.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  const createTestUserWithItems = async (options: {
    username: string;
    status: 'draft' | 'published';
  }) => {
    const user = await prisma.user.create({
      data: {
        email: `${options.username}@example.com`,
        username: options.username,
        name: 'Portfolio Tester',
        email_verified: true,
        profile: {
          create: {
            status: options.status,
            headline: 'Senior Full Stack Engineer',
            bio: 'Passionate about distributed systems',
            published_at: options.status === 'published' ? new Date() : null,
          },
        },
      },
    });

    const session = await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        user_id: user.id,
        expires_at: new Date(Date.now() + 86400000),
      },
    });

    const role1 = await prisma.role.create({
      data: {
        user_id: user.id,
        title: 'Backend Lead',
        position: 0,
        is_primary: true,
      },
    });

    const role2 = await prisma.role.create({
      data: {
        user_id: user.id,
        title: 'Frontend Lead',
        position: 1,
        is_primary: false,
      },
    });

    // Items for Role 1
    const item1 = await prisma.portfolioItem.create({
      data: {
        user_id: user.id,
        role_id: role1.id,
        kind: PortfolioItemKind.project,
        title: 'Distributed Queue Engine',
        url: 'https://github.com/example/queue',
        is_featured: true,
        is_hidden: false,
        position: 0,
      },
    });

    const item2 = await prisma.portfolioItem.create({
      data: {
        user_id: user.id,
        role_id: role1.id,
        kind: PortfolioItemKind.article,
        title: 'Deep Dive into Consensus Algorithms',
        url: 'https://medium.com/@example/consensus',
        is_featured: false,
        is_hidden: false,
        position: 1,
      },
    });

    const itemHidden = await prisma.portfolioItem.create({
      data: {
        user_id: user.id,
        role_id: role1.id,
        kind: PortfolioItemKind.other,
        title: 'Internal Confidential Doc',
        url: 'https://example.com/confidential',
        is_featured: true,
        is_hidden: true,
        position: 2,
      },
    });

    // Items for Role 2
    const item3 = await prisma.portfolioItem.create({
      data: {
        user_id: user.id,
        role_id: role2.id,
        kind: PortfolioItemKind.video,
        title: 'NextJS Performance Optimizations',
        url: 'https://youtube.com/watch?v=12345',
        is_featured: true,
        is_hidden: false,
        position: 0,
      },
    });

    const item4 = await prisma.portfolioItem.create({
      data: {
        user_id: user.id,
        role_id: role2.id,
        kind: PortfolioItemKind.course,
        title: 'CSS Grid & Flexbox Masterclass',
        url: 'https://example.com/course',
        is_featured: false,
        is_hidden: false,
        position: 1,
      },
    });

    return {
      user,
      sessionCookie: `session_id=${session.id}`,
      role1,
      role2,
      items: [item1, item2, itemHidden, item3, item4],
    };
  };

  describe('GET /public/:username', () => {
    it('returns public profile with featured_items for published user', async () => {
      const { user } = await createTestUserWithItems({
        username: 'alice',
        status: 'published',
      });

      const res = await request(app.getHttpServer())
        .get(`/public/${user.username}`)
        .expect(200);

      expect(res.body.username).toBe('alice');
      expect(res.body.status).toBe('published');
      expect(Array.isArray(res.body.featured_items)).toBe(true);

      // Should contain only visible featured items: item1 and item3 (itemHidden must NOT be present)
      expect(res.body.featured_items.length).toBe(2);
      expect(res.body.featured_items.some((i: any) => i.title === 'Distributed Queue Engine')).toBe(true);
      expect(res.body.featured_items.some((i: any) => i.title === 'NextJS Performance Optimizations')).toBe(true);
      expect(res.body.featured_items.some((i: any) => i.title === 'Internal Confidential Doc')).toBe(false);

      // Verify privacy: no user_id or internal fields exposed
      for (const item of res.body.featured_items) {
        expect(item.user_id).toBeUndefined();
        expect(item.is_hidden).toBeUndefined();
        expect(item.role).toBeDefined();
        expect(item.role.title).toBeDefined();
      }
    });

    it('returns 404 for draft user when viewed by anonymous visitor', async () => {
      const { user } = await createTestUserWithItems({
        username: 'bobdraft',
        status: 'draft',
      });

      await request(app.getHttpServer())
        .get(`/public/${user.username}`)
        .expect(404);
    });

    it('returns 200 with is_owner: true for draft user when viewed by owner', async () => {
      const { user, sessionCookie } = await createTestUserWithItems({
        username: 'bobdraft',
        status: 'draft',
      });

      const res = await request(app.getHttpServer())
        .get(`/public/${user.username}`)
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body.is_owner).toBe(true);
      expect(res.body.featured_items.length).toBe(2);
    });
  });

  describe('GET /public/:username/items', () => {
    it('returns visible items with pagination (limit and offset)', async () => {
      const { user } = await createTestUserWithItems({
        username: 'charlie',
        status: 'published',
      });

      // Total visible items = 4 (item1, item2, item3, item4)
      const resPage1 = await request(app.getHttpServer())
        .get(`/public/${user.username}/items?limit=2&offset=0`)
        .expect(200);

      expect(resPage1.body.total).toBe(4);
      expect(resPage1.body.items.length).toBe(2);
      expect(resPage1.body.has_more).toBe(true);

      const resPage2 = await request(app.getHttpServer())
        .get(`/public/${user.username}/items?limit=2&offset=2`)
        .expect(200);

      expect(resPage2.body.items.length).toBe(2);
      expect(resPage2.body.has_more).toBe(false);

      // Verify no duplicates between pages
      const page1Ids = resPage1.body.items.map((i: any) => i.id);
      const page2Ids = resPage2.body.items.map((i: any) => i.id);
      expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
    });

    it('filters items by role ID and role title', async () => {
      const { user, role1 } = await createTestUserWithItems({
        username: 'diana',
        status: 'published',
      });

      // Filter by role id
      const resById = await request(app.getHttpServer())
        .get(`/public/${user.username}/items?role=${role1.id}`)
        .expect(200);

      expect(resById.body.total).toBe(2); // item1, item2
      expect(resById.body.items.every((i: any) => i.role_id === role1.id)).toBe(true);

      // Filter by role title (case-insensitive)
      const resByTitle = await request(app.getHttpServer())
        .get(`/public/${user.username}/items?role=backend%20lead`)
        .expect(200);

      expect(resByTitle.body.total).toBe(2);
      expect(resByTitle.body.items.every((i: any) => i.role_id === role1.id)).toBe(true);
    });

    it('returns empty list when role filter does not match any role', async () => {
      const { user } = await createTestUserWithItems({
        username: 'eva',
        status: 'published',
      });

      const res = await request(app.getHttpServer())
        .get(`/public/${user.username}/items?role=nonexistent-role`)
        .expect(200);

      expect(res.body.total).toBe(0);
      expect(res.body.items).toEqual([]);
      expect(res.body.has_more).toBe(false);
    });

    it('never returns hidden items', async () => {
      const { user } = await createTestUserWithItems({
        username: 'frank',
        status: 'published',
      });

      const res = await request(app.getHttpServer())
        .get(`/public/${user.username}/items?limit=50`)
        .expect(200);

      expect(res.body.items.some((i: any) => i.title === 'Internal Confidential Doc')).toBe(false);
      expect(res.body.items.every((i: any) => i.user_id === undefined)).toBe(true);
    });

    it('returns 404 for draft items when viewed by stranger or anonymous', async () => {
      const { user } = await createTestUserWithItems({
        username: 'gracedraft',
        status: 'draft',
      });

      await request(app.getHttpServer())
        .get(`/public/${user.username}/items`)
        .expect(404);
    });

    it('allows owner to preview their draft items', async () => {
      const { user, sessionCookie } = await createTestUserWithItems({
        username: 'gracedraft',
        status: 'draft',
      });

      const res = await request(app.getHttpServer())
        .get(`/public/${user.username}/items`)
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body.total).toBe(4);
    });

    it('returns 404 for nonexistent username', async () => {
      await request(app.getHttpServer())
        .get('/public/nobody_here_xyz/items')
        .expect(404);
    });
  });
});
