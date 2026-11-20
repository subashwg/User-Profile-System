import crypto from 'node:crypto';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { BadRequestException, HttpException, HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import {
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateOrReservedIp,
  PreviewService,
} from '../src/items/services/preview.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Step 3 Item 6: Link Preview & SSRF Protection', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let previewService: PreviewService;

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
    previewService = app.get(PreviewService);
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
      prisma.loginMethod.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  async function createAuthUser(email = 'previewuser@example.com') {
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Preview User',
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

  describe('SSRF IP & Range Validator Unit Tests', () => {
    it('isPrivateIPv4 blocks loopback, private RFC1918, link-local, and reserved ranges', () => {
      // Loopback
      expect(isPrivateIPv4('127.0.0.1')).toBe(true);
      expect(isPrivateIPv4('127.0.0.254')).toBe(true);

      // Current network
      expect(isPrivateIPv4('0.0.0.0')).toBe(true);

      // Private Class A
      expect(isPrivateIPv4('10.0.0.1')).toBe(true);
      expect(isPrivateIPv4('10.254.254.254')).toBe(true);

      // Link-local / Cloud metadata service
      expect(isPrivateIPv4('169.254.169.254')).toBe(true);

      // Private Class B
      expect(isPrivateIPv4('172.16.0.1')).toBe(true);
      expect(isPrivateIPv4('172.31.255.255')).toBe(true);
      expect(isPrivateIPv4('172.32.0.1')).toBe(false); // Public

      // Private Class C
      expect(isPrivateIPv4('192.168.1.1')).toBe(true);
      expect(isPrivateIPv4('192.168.0.100')).toBe(true);

      // Carrier Grade NAT
      expect(isPrivateIPv4('100.64.0.1')).toBe(true);
      expect(isPrivateIPv4('100.127.255.255')).toBe(true);

      // Multicast and Broadcast
      expect(isPrivateIPv4('224.0.0.1')).toBe(true);
      expect(isPrivateIPv4('255.255.255.255')).toBe(true);

      // Public IPs
      expect(isPrivateIPv4('8.8.8.8')).toBe(false);
      expect(isPrivateIPv4('1.1.1.1')).toBe(false);
      expect(isPrivateIPv4('142.250.190.46')).toBe(false);
    });

    it('isPrivateIPv6 blocks loopback, link-local, unique local and mapped IPv4', () => {
      expect(isPrivateIPv6('::1')).toBe(true);
      expect(isPrivateIPv6('::')).toBe(true);
      expect(isPrivateIPv6('fe80::1')).toBe(true);
      expect(isPrivateIPv6('fc00::1')).toBe(true);
      expect(isPrivateIPv6('fd12:3456:789a::1')).toBe(true);
      expect(isPrivateIPv6('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateIPv6('::ffff:192.168.1.1')).toBe(true);
      expect(isPrivateIPv6('::ffff:8.8.8.8')).toBe(false);
      expect(isPrivateIPv6('2607:f8b0:4005:805::200e')).toBe(false); // Google public IPv6
    });

    it('isPrivateOrReservedIp rejects non-IP strings and invalid formats', () => {
      expect(isPrivateOrReservedIp('invalid-ip')).toBe(true);
      expect(isPrivateOrReservedIp('999.999.999.999')).toBe(true);
    });
  });

  describe('YouTube Shortcut', () => {
    it('extracts YouTube ID and creates thumbnail for standard, short and youtu.be links', async () => {
      const u1 = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(previewService.extractYouTubeId(u1)).toBe('dQw4w9WgXcQ');

      const u2 = new URL('https://youtu.be/dQw4w9WgXcQ');
      expect(previewService.extractYouTubeId(u2)).toBe('dQw4w9WgXcQ');

      const u3 = new URL('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share');
      expect(previewService.extractYouTubeId(u3)).toBe('dQw4w9WgXcQ');

      const u4 = new URL('https://youtube.com/embed/dQw4w9WgXcQ');
      expect(previewService.extractYouTubeId(u4)).toBe('dQw4w9WgXcQ');

      const nonYt = new URL('https://example.com/video');
      expect(previewService.extractYouTubeId(nonYt)).toBeNull();
    });

    it('returns preview result with video kind and YouTube thumbnail', async () => {
      const preview = await previewService.getPreview(
        'user-123',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );

      expect(preview.kind).toBe('video');
      expect(preview.source_site).toBe('YouTube');
      expect(preview.cover_url).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(preview.title).toBeDefined();
    });
  });

  describe('SSRF Security & Guard', () => {
    it('refuses private loopback address 127.0.0.1 with standard failure message', async () => {
      await expect(
        previewService.getPreview('user-123', 'http://127.0.0.1:8080/test'),
      ).rejects.toThrow(new BadRequestException("We couldn't read this link."));
    });

    it('refuses localhost hostname with standard failure message', async () => {
      await expect(
        previewService.getPreview('user-123', 'http://localhost:3000/api'),
      ).rejects.toThrow(new BadRequestException("We couldn't read this link."));
    });

    it('refuses cloud metadata service address 169.254.169.254', async () => {
      await expect(
        previewService.getPreview('user-123', 'http://169.254.169.254/latest/meta-data'),
      ).rejects.toThrow(new BadRequestException("We couldn't read this link."));
    });

    it('refuses private LAN address 192.168.1.1', async () => {
      await expect(
        previewService.getPreview('user-123', 'http://192.168.1.1/admin'),
      ).rejects.toThrow(new BadRequestException("We couldn't read this link."));
    });

    it('refuses non-http/https protocol schemes (javascript, file, ftp)', async () => {
      await expect(
        previewService.getPreview('user-123', 'javascript:alert(1)'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        previewService.getPreview('user-123', 'file:///etc/passwd'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        previewService.getPreview('user-123', 'ftp://ftp.example.com/file'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /items/preview (HTTP End-to-End)', () => {
    it('Happy path: extracts metadata for a YouTube URL', async () => {
      const { sessionCookie } = await createAuthUser('ytpreview@example.com');

      const res = await request(app.getHttpServer())
        .post('/items/preview')
        .set('Cookie', sessionCookie)
        .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
        .expect(200);

      expect(res.body.kind).toBe('video');
      expect(res.body.source_site).toBe('YouTube');
      expect(res.body.cover_url).toContain('img.youtube.com');
      expect(res.body.title).toBeDefined();
    });

    it('Failure: requires authentication (401)', async () => {
      await request(app.getHttpServer())
        .post('/items/preview')
        .send({ url: 'https://youtube.com/watch?v=123' })
        .expect(401);
    });

    it('Failure: rejects private address through HTTP (400) without revealing internal errors', async () => {
      const { sessionCookie } = await createAuthUser('ssrftest@example.com');

      const res = await request(app.getHttpServer())
        .post('/items/preview')
        .set('Cookie', sessionCookie)
        .send({ url: 'http://127.0.0.1:3000/secret' })
        .expect(400);

      expect(res.body.message).toBe("We couldn't read this link.");
    });

    it('Rate limiting: allows up to 20 requests per minute and blocks the 21st with 429', async () => {
      const { sessionCookie } = await createAuthUser('ratelimited@example.com');

      // Make 20 requests
      for (let i = 0; i < 20; i++) {
        await request(app.getHttpServer())
          .post('/items/preview')
          .set('Cookie', sessionCookie)
          .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
          .expect(200);
      }

      // 21st request must trigger 429 Too Many Requests
      const res = await request(app.getHttpServer())
        .post('/items/preview')
        .set('Cookie', sessionCookie)
        .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
        .expect(429);

      expect(res.body.message).toContain('Too many preview requests');
    });
  });
});
