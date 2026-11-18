import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Avatar Upload, Resize, Replace & Remove (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailService: MailService;
  let validPngBuffer: Buffer;
  let validJpgBuffer: Buffer;

  beforeAll(async () => {
    validPngBuffer = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 4,
        background: { r: 50, g: 120, b: 220, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    validJpgBuffer = await sharp({
      create: {
        width: 150,
        height: 150,
        channels: 3,
        background: { r: 220, g: 80, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();

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

  describe('POST /profile/avatar', () => {
    it('Failure Case: should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post('/profile/avatar')
        .attach('avatar', validPngBuffer, 'avatar.png')
        .expect(401);
    });

    it('Failure Case: should reject request with no file attached with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'nofile@example.com', password: 'Password123' })
        .expect(201);

      const cookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookie)
        .expect(400);

      expect(res.body.message).toContain('required');
    });

    it('Failure Case: should reject fake image (text file disguised as image) with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'fakeimg@example.com', password: 'Password123' })
        .expect(201);

      const cookie = regRes.headers['set-cookie'];
      const fakeBuffer = Buffer.from('Not a real image file! Just plaintext content.');

      const res = await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookie)
        .attach('avatar', fakeBuffer, 'fake.png')
        .expect(400);

      expect(res.body.message).toContain('Only JPEG, PNG, and WebP');
    });

    it('Failure Case: should reject unsupported file format (SVG/GIF) with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'svg@example.com', password: 'Password123' })
        .expect(201);

      const cookie = regRes.headers['set-cookie'];
      const svgBuffer = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
      );

      const res = await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookie)
        .attach('avatar', svgBuffer, 'vector.svg')
        .expect(400);

      expect(res.body.message).toContain('Only JPEG, PNG, and WebP');
    });

    it('Failure Case: should reject oversized file (> 2MB) with 400', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'oversized@example.com', password: 'Password123' })
        .expect(201);

      const cookie = regRes.headers['set-cookie'];
      // Create a 2.5MB buffer with valid PNG signature
      const bigBuffer = Buffer.alloc(2.5 * 1024 * 1024);
      validPngBuffer.copy(bigBuffer, 0, 0, Math.min(validPngBuffer.length, bigBuffer.length));

      const res = await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookie)
        .attach('avatar', bigBuffer, 'huge.png')
        .expect(400);

      expect(res.body.message).toContain('exceed');
    });

    it('Happy Path: should successfully upload, crop to 512x512 WebP and serve the avatar', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'uploadok@example.com', password: 'Password123' })
        .expect(201);

      const cookie = regRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookie)
        .attach('avatar', validPngBuffer, 'photo.png')
        .expect(200);

      expect(res.body.avatar_url).toMatch(/^\/uploads\/avatars\/[a-f0-9-]+\.webp$/);
      expect(res.body.effective_avatar_url).toBe(res.body.avatar_url);

      // Verify static asset serving
      const fetchRes = await request(app.getHttpServer())
        .get(res.body.avatar_url)
        .expect(200);

      expect(fetchRes.headers['content-type']).toContain('image/webp');

      // Verify sharp metadata of served file
      const meta = await sharp(fetchRes.body).metadata();
      expect(meta.width).toBe(512);
      expect(meta.height).toBe(512);
      expect(meta.format).toBe('webp');

      // Verify profile record is updated
      const profile = await prisma.profile.findUnique({
        where: { user_id: regRes.body.user.id },
      });
      expect(profile?.avatar_url).toBe(res.body.avatar_url);
    });

    it('Happy Path: replacing avatar deletes previous avatar file from disk', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'replace@example.com', password: 'Password123' })
        .expect(201);

      const cookie = regRes.headers['set-cookie'];

      // First upload
      const res1 = await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookie)
        .attach('avatar', validPngBuffer, 'avatar1.png')
        .expect(200);

      const firstAvatarUrl = res1.body.avatar_url;
      await request(app.getHttpServer()).get(firstAvatarUrl).expect(200);

      // Second upload replaces first
      const res2 = await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookie)
        .attach('avatar', validJpgBuffer, 'avatar2.jpg')
        .expect(200);

      const secondAvatarUrl = res2.body.avatar_url;
      expect(secondAvatarUrl).not.toBe(firstAvatarUrl);

      // Old avatar file must now be gone (404)
      await request(app.getHttpServer()).get(firstAvatarUrl).expect(404);

      // New avatar file must be available (200)
      await request(app.getHttpServer()).get(secondAvatarUrl).expect(200);
    });
  });

  describe('DELETE /profile/avatar', () => {
    it('Failure Case: should reject unauthenticated delete with 401', async () => {
      await request(app.getHttpServer()).delete('/profile/avatar').expect(401);
    });

    it('Happy Path: should remove uploaded avatar, delete file and fallback to null or Google photo', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'deleteavatar@example.com', password: 'Password123' })
        .expect(201);

      const cookie = regRes.headers['set-cookie'];

      // Upload avatar
      const upRes = await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookie)
        .attach('avatar', validPngBuffer, 'avatar.png')
        .expect(200);

      const avatarUrl = upRes.body.avatar_url;
      await request(app.getHttpServer()).get(avatarUrl).expect(200);

      // Delete avatar
      const delRes = await request(app.getHttpServer())
        .delete('/profile/avatar')
        .set('Cookie', cookie)
        .expect(200);

      expect(delRes.body.avatar_url).toBeNull();
      expect(delRes.body.effective_avatar_url).toBeNull();

      // File is deleted
      await request(app.getHttpServer()).get(avatarUrl).expect(404);

      // Test fallback to Google photo when user has a provider avatar
      const googlePhotoUrl = 'https://lh3.googleusercontent.com/a/test-google-avatar';
      await prisma.user.update({
        where: { id: regRes.body.user.id },
        data: { avatar_url: googlePhotoUrl },
      });

      // Upload again
      await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookie)
        .attach('avatar', validPngBuffer, 'avatar.png')
        .expect(200);

      // Delete again -> effective_avatar_url falls back to Google photo!
      const delRes2 = await request(app.getHttpServer())
        .delete('/profile/avatar')
        .set('Cookie', cookie)
        .expect(200);

      expect(delRes2.body.avatar_url).toBeNull();
      expect(delRes2.body.effective_avatar_url).toBe(googlePhotoUrl);

      // GET /profile/me also reflects the fallback
      const meRes = await request(app.getHttpServer())
        .get('/profile/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(meRes.body.avatar_url).toBeNull();
      expect(meRes.body.effective_avatar_url).toBe(googlePhotoUrl);
    });

    it('Ownership Isolation: User A operations cannot affect User B avatar', async () => {
      // User A
      const userARes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'usera@example.com', password: 'Password123' })
        .expect(201);
      const cookieA = userARes.headers['set-cookie'];

      // User B
      const userBRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'userb@example.com', password: 'Password123' })
        .expect(201);
      const cookieB = userBRes.headers['set-cookie'];

      // Both upload avatars
      const upA = await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookieA)
        .attach('avatar', validPngBuffer, 'avatarA.png')
        .expect(200);

      const upB = await request(app.getHttpServer())
        .post('/profile/avatar')
        .set('Cookie', cookieB)
        .attach('avatar', validJpgBuffer, 'avatarB.jpg')
        .expect(200);

      // User A deletes avatar
      await request(app.getHttpServer())
        .delete('/profile/avatar')
        .set('Cookie', cookieA)
        .expect(200);

      // User B avatar must still exist
      await request(app.getHttpServer()).get(upB.body.avatar_url).expect(200);

      const meB = await request(app.getHttpServer())
        .get('/profile/me')
        .set('Cookie', cookieB)
        .expect(200);

      expect(meB.body.avatar_url).toBe(upB.body.avatar_url);
    });
  });
});
