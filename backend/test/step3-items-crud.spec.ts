import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CoverSource, PortfolioItemKind, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ItemsService } from '../src/items/items.service.js';
import { canonicalizeUrl, deriveSourceSite, sanitizePlainText } from '../src/items/utils/url.util.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Step 3: Items CRUD without Previews (Build-Order Item 3)', () => {
  let prisma: PrismaService;
  let itemsService: ItemsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    itemsService = new ItemsService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
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

  describe('URL Utilities', () => {
    it('canonicalizeUrl should strip tracking params, normalize casing, and remove trailing slashes', () => {
      const url1 = 'https://YOUTUBE.COM/watch?v=dQw4w9WgXcQ&utm_source=twitter&utm_medium=social/';
      const url2 = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
      expect(canonicalizeUrl(url1)).toBe(canonicalizeUrl(url2));
      expect(canonicalizeUrl('https://example.com/project/')).toBe('https://example.com/project');
    });

    it('deriveSourceSite should detect popular sites and fall back to clean domain', () => {
      expect(deriveSourceSite('https://www.youtube.com/watch?v=123')).toBe('YouTube');
      expect(deriveSourceSite('https://github.com/torvalds/linux')).toBe('GitHub');
      expect(deriveSourceSite('https://medium.com/@user/article')).toBe('Medium');
      expect(deriveSourceSite('https://myawesomeblog.com/post/1')).toBe('Myawesomeblog');
    });

    it('sanitizePlainText should strip HTML tags', () => {
      expect(sanitizePlainText('<b>Bold</b> <script>alert(1)</script> Title')).toBe('Bold alert(1) Title');
    });
  });

  describe('Happy Path CRUD', () => {
    it('should create portfolio items under roles with correct positions and auto-derived source site', async () => {
      const user = await prisma.user.create({
        data: { email: 'author@example.com', name: 'Author', username: 'author' },
      });

      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Video Producer', is_primary: true },
      });

      const item1 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.video,
        title: 'Building Modern Web Apps',
        description: 'A deep dive into frontend architecture.',
        url: 'https://youtube.com/watch?v=abc1234',
        is_featured: true,
      });

      expect(item1.id).toBeDefined();
      expect(item1.title).toBe('Building Modern Web Apps');
      expect(item1.source_site).toBe('YouTube');
      expect(item1.position).toBe(0);
      expect(item1.is_featured).toBe(true);
      expect(item1.is_hidden).toBe(false);
      expect(item1.role.title).toBe('Video Producer');

      const item2 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.article,
        title: 'CSS Architecture Guide',
        url: 'https://medium.com/@author/css-guide',
      });

      expect(item2.position).toBe(1);
      expect(item2.source_site).toBe('Medium');
      expect(item2.is_featured).toBe(false);
    });

    it('should get items grouped by role and flat', async () => {
      const user = await prisma.user.create({
        data: { email: 'grouped@example.com', name: 'User', username: 'groupeduser' },
      });

      const roleA = await prisma.role.create({
        data: { user_id: user.id, title: 'Engineer', position: 0 },
      });
      const roleB = await prisma.role.create({
        data: { user_id: user.id, title: 'Writer', position: 1 },
      });

      await itemsService.createItem(user.id, {
        role_id: roleA.id,
        kind: PortfolioItemKind.project,
        title: 'Open Source CLI',
        url: 'https://github.com/user/cli',
      });
      await itemsService.createItem(user.id, {
        role_id: roleB.id,
        kind: PortfolioItemKind.article,
        title: 'Writing for Developers',
        url: 'https://dev.to/user/writing',
        is_hidden: true,
      });

      // Grouped list
      const grouped = await itemsService.getItems(user.id);
      expect(grouped).toHaveLength(2);
      expect(grouped[0].role.title).toBe('Engineer');
      expect(grouped[0].items).toHaveLength(1);
      expect(grouped[1].role.title).toBe('Writer');
      expect(grouped[1].items).toHaveLength(1);
      expect(grouped[1].items[0].is_hidden).toBe(true);

      // Flat list
      const flat = await itemsService.getItems(user.id, true);
      expect(Array.isArray(flat)).toBe(true);
      expect(flat).toHaveLength(2);
    });

    it('should get single item by id', async () => {
      const user = await prisma.user.create({
        data: { email: 'single@example.com', name: 'Single', username: 'single' },
      });
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Speaker', is_primary: true },
      });
      const created = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.video,
        title: 'Keynote 2026',
        url: 'https://youtube.com/watch?v=keynote',
      });

      const fetched = await itemsService.getItem(user.id, created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.title).toBe('Keynote 2026');
    });

    it('should update item details and toggle featured/hidden', async () => {
      const user = await prisma.user.create({
        data: { email: 'updater@example.com', name: 'Updater', username: 'updater' },
      });
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Designer', is_primary: true },
      });
      const item = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.project,
        title: 'Original Title',
        url: 'https://figma.com/file/12345',
      });

      const updated = await itemsService.updateItem(user.id, item.id, {
        title: 'Updated Title',
        description: 'New description',
        is_featured: true,
        is_hidden: true,
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('New description');
      expect(updated.is_featured).toBe(true);
      expect(updated.is_hidden).toBe(true);
    });

    it('should move item between roles and properly re-index both old and new role items', async () => {
      const user = await prisma.user.create({
        data: { email: 'mover@example.com', name: 'Mover', username: 'mover' },
      });
      const role1 = await prisma.role.create({
        data: { user_id: user.id, title: 'Role 1', position: 0 },
      });
      const role2 = await prisma.role.create({
        data: { user_id: user.id, title: 'Role 2', position: 1 },
      });

      // Role 1 gets 3 items (positions 0, 1, 2)
      const itemA = await itemsService.createItem(user.id, {
        role_id: role1.id,
        kind: PortfolioItemKind.project,
        title: 'Item A',
        url: 'https://github.com/user/a',
      });
      const itemB = await itemsService.createItem(user.id, {
        role_id: role1.id,
        kind: PortfolioItemKind.project,
        title: 'Item B',
        url: 'https://github.com/user/b',
      });
      const itemC = await itemsService.createItem(user.id, {
        role_id: role1.id,
        kind: PortfolioItemKind.project,
        title: 'Item C',
        url: 'https://github.com/user/c',
      });

      // Role 2 gets 1 item (position 0)
      const itemD = await itemsService.createItem(user.id, {
        role_id: role2.id,
        kind: PortfolioItemKind.article,
        title: 'Item D',
        url: 'https://medium.com/user/d',
      });

      // Move Item B from Role 1 to Role 2
      const moved = await itemsService.updateItem(user.id, itemB.id, {
        role_id: role2.id,
      });

      // Item B should now be in role 2 at position 1 (after item D)
      expect(moved.role_id).toBe(role2.id);
      expect(moved.position).toBe(1);

      // Remaining items in Role 1 (A and C) must be re-indexed to 0 and 1
      const role1Items = await prisma.portfolioItem.findMany({
        where: { role_id: role1.id },
        orderBy: { position: 'asc' },
      });
      expect(role1Items).toHaveLength(2);
      expect(role1Items[0].id).toBe(itemA.id);
      expect(role1Items[0].position).toBe(0);
      expect(role1Items[1].id).toBe(itemC.id);
      expect(role1Items[1].position).toBe(1);

      // Role 2 items must be D (pos 0) and B (pos 1)
      const role2Items = await prisma.portfolioItem.findMany({
        where: { role_id: role2.id },
        orderBy: { position: 'asc' },
      });
      expect(role2Items).toHaveLength(2);
      expect(role2Items[0].id).toBe(itemD.id);
      expect(role2Items[0].position).toBe(0);
      expect(role2Items[1].id).toBe(itemB.id);
      expect(role2Items[1].position).toBe(1);
    });

    it('should delete item and re-index remaining items in role', async () => {
      const user = await prisma.user.create({
        data: { email: 'deleter@example.com', name: 'Deleter', username: 'deleter' },
      });
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Tester', is_primary: true },
      });

      const i0 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.other,
        title: 'Item 0',
        url: 'https://example.com/0',
      });
      const i1 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.other,
        title: 'Item 1',
        url: 'https://example.com/1',
      });
      const i2 = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.other,
        title: 'Item 2',
        url: 'https://example.com/2',
      });

      // Delete middle item i1
      const res = await itemsService.deleteItem(user.id, i1.id);
      expect(res.success).toBe(true);

      const remaining = await prisma.portfolioItem.findMany({
        where: { role_id: role.id },
        orderBy: { position: 'asc' },
      });
      expect(remaining).toHaveLength(2);
      expect(remaining[0].id).toBe(i0.id);
      expect(remaining[0].position).toBe(0);
      expect(remaining[1].id).toBe(i2.id);
      expect(remaining[1].position).toBe(1);
    });
  });

  describe('Limits, Constraints & Failure Cases', () => {
    it('should refuse to create an item under another user role', async () => {
      const user1 = await prisma.user.create({
        data: { email: 'u1@example.com', name: 'U1', username: 'u1' },
      });
      const user2 = await prisma.user.create({
        data: { email: 'u2@example.com', name: 'U2', username: 'u2' },
      });
      const roleOfUser2 = await prisma.role.create({
        data: { user_id: user2.id, title: 'Role User 2', is_primary: true },
      });

      await expect(
        itemsService.createItem(user1.id, {
          role_id: roleOfUser2.id,
          kind: PortfolioItemKind.project,
          title: 'Stealing Role',
          url: 'https://example.com/steal',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should refuse to access or mutate another user item (404)', async () => {
      const user1 = await prisma.user.create({
        data: { email: 'owner1@example.com', name: 'Owner', username: 'owner1' },
      });
      const user2 = await prisma.user.create({
        data: { email: 'attacker@example.com', name: 'Attacker', username: 'attacker' },
      });
      const role1 = await prisma.role.create({
        data: { user_id: user1.id, title: 'Role 1', is_primary: true },
      });

      const item = await itemsService.createItem(user1.id, {
        role_id: role1.id,
        kind: PortfolioItemKind.project,
        title: 'Private Project',
        url: 'https://example.com/project',
      });

      // Attacker tries to GET
      await expect(itemsService.getItem(user2.id, item.id)).rejects.toThrow(NotFoundException);

      // Attacker tries to PATCH
      await expect(
        itemsService.updateItem(user2.id, item.id, { title: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);

      // Attacker tries to DELETE
      await expect(itemsService.deleteItem(user2.id, item.id)).rejects.toThrow(NotFoundException);
    });

    it('should enforce 50 items per user limit', async () => {
      const user = await prisma.user.create({
        data: { email: 'fifty@example.com', name: 'Fifty', username: 'fifty' },
      });
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Bulk Role', is_primary: true },
      });

      // Create 50 items directly in DB
      const itemsData = Array.from({ length: 50 }, (_, i) => ({
        user_id: user.id,
        role_id: role.id,
        kind: PortfolioItemKind.other,
        title: `Item ${i}`,
        url: `https://example.com/item-${i}`,
        position: i,
      }));
      await prisma.portfolioItem.createMany({ data: itemsData });

      // Attempting 51st item must throw BadRequestException
      await expect(
        itemsService.createItem(user.id, {
          role_id: role.id,
          kind: PortfolioItemKind.other,
          title: '51st Item',
          url: 'https://example.com/item-51',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce 5 featured items per user limit on create and update', async () => {
      const user = await prisma.user.create({
        data: { email: 'featured@example.com', name: 'Featured User', username: 'featureduser' },
      });
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Star Role', is_primary: true },
      });

      // Create 5 featured items
      for (let i = 0; i < 5; i++) {
        await itemsService.createItem(user.id, {
          role_id: role.id,
          kind: PortfolioItemKind.video,
          title: `Featured ${i}`,
          url: `https://example.com/feat-${i}`,
          is_featured: true,
        });
      }

      // 6th featured on create should fail
      await expect(
        itemsService.createItem(user.id, {
          role_id: role.id,
          kind: PortfolioItemKind.video,
          title: '6th Featured',
          url: 'https://example.com/feat-6',
          is_featured: true,
        }),
      ).rejects.toThrow(BadRequestException);

      // Create non-featured item
      const unfeatured = await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.video,
        title: 'Unfeatured',
        url: 'https://example.com/unfeat',
        is_featured: false,
      });

      // Trying to update unfeatured item to featured should also fail with limit exceeded
      await expect(
        itemsService.updateItem(user.id, unfeatured.id, {
          is_featured: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate links per user (including tracking params and trailing slashes)', async () => {
      const user = await prisma.user.create({
        data: { email: 'dups@example.com', name: 'Dups', username: 'dups' },
      });
      const role = await prisma.role.create({
        data: { user_id: user.id, title: 'Dup Role', is_primary: true },
      });

      await itemsService.createItem(user.id, {
        role_id: role.id,
        kind: PortfolioItemKind.article,
        title: 'Original Article',
        url: 'https://dev.to/user/clean-architecture',
      });

      // 1. Exact duplicate
      await expect(
        itemsService.createItem(user.id, {
          role_id: role.id,
          kind: PortfolioItemKind.article,
          title: 'Duplicate Exact',
          url: 'https://dev.to/user/clean-architecture',
        }),
      ).rejects.toThrow(BadRequestException);

      // 2. Trailing slash duplicate
      await expect(
        itemsService.createItem(user.id, {
          role_id: role.id,
          kind: PortfolioItemKind.article,
          title: 'Duplicate Slash',
          url: 'https://dev.to/user/clean-architecture/',
        }),
      ).rejects.toThrow(BadRequestException);

      // 3. Tracking parameters duplicate (utm_source, fbclid)
      await expect(
        itemsService.createItem(user.id, {
          role_id: role.id,
          kind: PortfolioItemKind.article,
          title: 'Duplicate Tracking',
          url: 'https://dev.to/user/clean-architecture?utm_source=twitter&fbclid=IwAR123',
        }),
      ).rejects.toThrow(BadRequestException);

      // Different user CAN add the same link
      const user2 = await prisma.user.create({
        data: { email: 'dups2@example.com', name: 'Dups 2', username: 'dups2' },
      });
      const role2 = await prisma.role.create({
        data: { user_id: user2.id, title: 'Role 2', is_primary: true },
      });
      const itemUser2 = await itemsService.createItem(user2.id, {
        role_id: role2.id,
        kind: PortfolioItemKind.article,
        title: 'Same Link for User 2',
        url: 'https://dev.to/user/clean-architecture',
      });
      expect(itemUser2.id).toBeDefined();
    });
  });
});
