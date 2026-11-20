import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioItemKind } from '@prisma/client';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ItemsService } from '../src/items/items.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StorageService } from '../src/storage/storage.service.js';

describe('Step 3 Item 7: Cover Upload, Resizing & Storage (Integration & E2E)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let itemsService: ItemsService;
  let storageService: StorageService;

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
    storageService = app.get(StorageService);
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

  async function createAuthUser(email = 'coveruser@example.com') {
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Cover User',
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

  async function createSampleImageBuffer(width = 800, height = 600): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 14, g: 124, b: 123 }, // Accent color
      },
    })
      .jpeg()
      .toBuffer();
  }

  describe('POST /items/:id/cover', () => {
    it('Happy path: uploads 16:9 cropped cover, generates full (1280x720) and thumb (640x360)', async () => {
      const { user, sessionCookie } = await createAuthUser('uploadhappy@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Designer', is_primary: true },
      });

      const item = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Brand Identity',
        url: 'https://behance.net/brand',
      });

      const imageBuffer = await createSampleImageBuffer(1600, 1000);

      const res = await request(app.getHttpServer())
        .post(`/items/${item.id}/cover`)
        .set('Cookie', sessionCookie)
        .attach('file', imageBuffer, 'sample.jpg')
        .expect(200);

      expect(res.body.cover_url).toMatch(/^\/uploads\/covers\/[a-f0-9-]+\.webp$/);
      expect(res.body.cover_source).toBe('upload');

      // Verify files exist on disk
      const filename = path.basename(res.body.cover_url);
      const fullPath = storageService.getCoverFilePath(filename);
      expect(fullPath).not.toBeNull();
      expect(fs.existsSync(fullPath!)).toBe(true);

      const thumbFilename = filename.replace('.webp', '-thumb.webp');
      const thumbPath = storageService.getCoverFilePath(thumbFilename);
      expect(thumbPath).not.toBeNull();
      expect(fs.existsSync(thumbPath!)).toBe(true);

      // Verify dimensions
      const fullMeta = await sharp(fullPath!).metadata();
      expect(fullMeta.width).toBe(1280);
      expect(fullMeta.height).toBe(720);
      expect(fullMeta.format).toBe('webp');

      const thumbMeta = await sharp(thumbPath!).metadata();
      expect(thumbMeta.width).toBe(640);
      expect(thumbMeta.height).toBe(360);
      expect(thumbMeta.format).toBe('webp');
    });

    it('Failure: rejects fake image files (400)', async () => {
      const { user, sessionCookie } = await createAuthUser('fakeimg@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Dev', is_primary: true },
      });
      const item = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Fake Test',
        url: 'https://example.com/fake',
      });

      const fakeBuffer = Buffer.from('This is a malicious text payload pretending to be an image');

      const res = await request(app.getHttpServer())
        .post(`/items/${item.id}/cover`)
        .set('Cookie', sessionCookie)
        .attach('file', fakeBuffer, 'malicious.png')
        .expect(400);

      expect(res.body.message).toContain('Only JPEG, PNG, and WebP images are allowed');
    });

    it('Failure: rejects files larger than 5 MB (400)', async () => {
      const { user, sessionCookie } = await createAuthUser('oversize@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Dev', is_primary: true },
      });
      const item = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Large Test',
        url: 'https://example.com/large',
      });

      const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024); // 5.5 MB

      const res = await request(app.getHttpServer())
        .post(`/items/${item.id}/cover`)
        .set('Cookie', sessionCookie)
        .attach('file', largeBuffer, 'huge.jpg')
        .expect(400);

      expect(res.body.message).toContain('5MB');
    });

    it('Failure: rejects upload for another user item (404)', async () => {
      const { user: userA } = await createAuthUser('userA@example.com');
      const { sessionCookie: cookieB } = await createAuthUser('userB@example.com');

      const roleA = await prisma.role.create({
        data: { user_id: userA.id, title: 'Role A', is_primary: true },
      });
      const itemA = await itemsService.createItem(userA.id, {
        role_id: roleA.id,
        kind: PortfolioItemKind.project,
        title: 'Item A',
        url: 'https://a.com',
      });

      const imageBuffer = await createSampleImageBuffer();

      await request(app.getHttpServer())
        .post(`/items/${itemA.id}/cover`)
        .set('Cookie', cookieB)
        .attach('file', imageBuffer, 'sample.jpg')
        .expect(404);
    });
  });

  describe('Replace & Delete Cover Cleanups', () => {
    it('deleting cover removes files from disk and sets cover_source to none', async () => {
      const { user, sessionCookie } = await createAuthUser('delcover@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Artist', is_primary: true },
      });
      const item = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Painting',
        url: 'https://art.com/painting',
      });

      const imageBuffer = await createSampleImageBuffer();

      // Upload cover
      const uploadRes = await request(app.getHttpServer())
        .post(`/items/${item.id}/cover`)
        .set('Cookie', sessionCookie)
        .attach('file', imageBuffer, 'sample.jpg')
        .expect(200);

      const filename = path.basename(uploadRes.body.cover_url);
      const fullPath = storageService.getCoverFilePath(filename);
      expect(fs.existsSync(fullPath!)).toBe(true);

      // Delete cover
      const deleteRes = await request(app.getHttpServer())
        .delete(`/items/${item.id}/cover`)
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(deleteRes.body.cover_url).toBeNull();
      expect(deleteRes.body.cover_source).toBe('none');

      // Verify file deleted from disk
      expect(fs.existsSync(fullPath!)).toBe(false);
    });

    it('replacing cover unlinks prior uploaded cover file', async () => {
      const { user, sessionCookie } = await createAuthUser('replacecover@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Photographer', is_primary: true },
      });
      const item = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Gallery',
        url: 'https://photo.com/gallery',
      });

      // First upload
      const img1 = await createSampleImageBuffer(800, 600);
      const res1 = await request(app.getHttpServer())
        .post(`/items/${item.id}/cover`)
        .set('Cookie', sessionCookie)
        .attach('file', img1, 'first.jpg')
        .expect(200);

      const file1 = path.basename(res1.body.cover_url);
      const path1 = storageService.getCoverFilePath(file1);
      expect(fs.existsSync(path1!)).toBe(true);

      // Second upload (replace)
      const img2 = await createSampleImageBuffer(1000, 800);
      const res2 = await request(app.getHttpServer())
        .post(`/items/${item.id}/cover`)
        .set('Cookie', sessionCookie)
        .attach('file', img2, 'second.jpg')
        .expect(200);

      const file2 = path.basename(res2.body.cover_url);
      const path2 = storageService.getCoverFilePath(file2);

      // Verify file1 is unlinked and file2 exists
      expect(fs.existsSync(path1!)).toBe(false);
      expect(fs.existsSync(path2!)).toBe(true);
    });

    it('deleting item deletes its uploaded cover file from disk', async () => {
      const { user, sessionCookie } = await createAuthUser('itemdelcleanup@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Maker', is_primary: true },
      });
      const item = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.product,
        title: 'Gadget',
        url: 'https://gadget.com',
      });

      const img = await createSampleImageBuffer();
      const uploadRes = await request(app.getHttpServer())
        .post(`/items/${item.id}/cover`)
        .set('Cookie', sessionCookie)
        .attach('file', img, 'gadget.jpg')
        .expect(200);

      const filename = path.basename(uploadRes.body.cover_url);
      const filePath = storageService.getCoverFilePath(filename);
      expect(fs.existsSync(filePath!)).toBe(true);

      // Delete the entire item
      await request(app.getHttpServer())
        .delete(`/items/${item.id}`)
        .set('Cookie', sessionCookie)
        .expect(200);

      // Verify cover file was cleaned up
      expect(fs.existsSync(filePath!)).toBe(false);
    });
  });

  describe('Serving Cover Images', () => {
    it('GET /uploads/covers/:filename serves the image with cache headers', async () => {
      const { user, sessionCookie } = await createAuthUser('servecover@example.com');
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Dev', is_primary: true },
      });
      const item = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Web App',
        url: 'https://app.dev',
      });

      const img = await createSampleImageBuffer();
      const uploadRes = await request(app.getHttpServer())
        .post(`/items/${item.id}/cover`)
        .set('Cookie', sessionCookie)
        .attach('file', img, 'webapp.jpg')
        .expect(200);

      const filename = path.basename(uploadRes.body.cover_url);

      const res = await request(app.getHttpServer())
        .get(`/uploads/covers/${filename}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('image/webp');
      expect(res.headers['cache-control']).toBe('public, max-age=86400');
    });

    it('GET /uploads/covers/:filename returns 404 for nonexistent cover', async () => {
      await request(app.getHttpServer())
        .get('/uploads/covers/nonexistent-cover.webp')
        .expect(404);
    });
  });
});
