import { PrismaClient, PortfolioItemKind, CoverSource } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Step 3: Database & PortfolioItem Model (Integration)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
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

  it('Happy Path: should create a portfolio item linked to a user and a role', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'creator@example.com',
        name: 'Portfolio Creator',
        username: 'portfoliocreator',
      },
    });

    const role = await prisma.role.create({
      data: {
        user_id: user.id,
        title: 'Content Creator',
        is_primary: true,
      },
    });

    const item = await prisma.portfolioItem.create({
      data: {
        user_id: user.id,
        role_id: role.id,
        kind: PortfolioItemKind.video,
        title: 'Mastering Playwright in 2026',
        description: 'Complete end to end automation guide from zero to hero.',
        url: 'https://youtube.com/watch?v=sample123',
        cover_url: 'https://img.youtube.com/vi/sample123/hqdefault.jpg',
        cover_source: CoverSource.link,
        source_site: 'YouTube',
        is_featured: true,
        is_hidden: false,
        position: 0,
      },
    });

    expect(item.id).toBeDefined();
    expect(item.title).toBe('Mastering Playwright in 2026');
    expect(item.kind).toBe(PortfolioItemKind.video);
    expect(item.cover_source).toBe(CoverSource.link);
    expect(item.source_site).toBe('YouTube');
    expect(item.is_featured).toBe(true);
    expect(item.is_hidden).toBe(false);
    expect(item.position).toBe(0);

    // Verify relations
    const roleWithItems = await prisma.role.findUnique({
      where: { id: role.id },
      include: { items: true },
    });
    expect(roleWithItems?.items.length).toBe(1);
    expect(roleWithItems?.items[0].id).toBe(item.id);

    const userWithItems = await prisma.user.findUnique({
      where: { id: user.id },
      include: { portfolio_items: true },
    });
    expect(userWithItems?.portfolio_items.length).toBe(1);
  });

  it('Enum Support: should support all 6 portfolio item kinds', async () => {
    const user = await prisma.user.create({
      data: { email: 'enums@example.com', username: 'enumtester' },
    });

    const role = await prisma.role.create({
      data: { user_id: user.id, title: 'Multi-Role' },
    });

    const allKinds: PortfolioItemKind[] = [
      PortfolioItemKind.video,
      PortfolioItemKind.article,
      PortfolioItemKind.course,
      PortfolioItemKind.project,
      PortfolioItemKind.product,
      PortfolioItemKind.other,
    ];

    for (let i = 0; i < allKinds.length; i++) {
      const item = await prisma.portfolioItem.create({
        data: {
          user_id: user.id,
          role_id: role.id,
          kind: allKinds[i],
          title: `Item of kind ${allKinds[i]}`,
          url: `https://example.com/item-${i}`,
          position: i,
        },
      });
      expect(item.kind).toBe(allKinds[i]);
    }

    const count = await prisma.portfolioItem.count({ where: { user_id: user.id } });
    expect(count).toBe(6);
  });

  it('Cascade Deletion: deleting a role must automatically cascade delete its portfolio items', async () => {
    const user = await prisma.user.create({
      data: { email: 'cascade@example.com', username: 'cascadetester' },
    });

    const roleA = await prisma.role.create({
      data: { user_id: user.id, title: 'QA Engineer', position: 0 },
    });
    const roleB = await prisma.role.create({
      data: { user_id: user.id, title: 'Developer', position: 1 },
    });

    await prisma.portfolioItem.create({
      data: {
        user_id: user.id,
        role_id: roleA.id,
        kind: PortfolioItemKind.project,
        title: 'QA Framework',
        url: 'https://github.com/sample/qa-framework',
      },
    });

    await prisma.portfolioItem.create({
      data: {
        user_id: user.id,
        role_id: roleB.id,
        kind: PortfolioItemKind.article,
        title: 'Dev Article',
        url: 'https://medium.com/sample-dev',
      },
    });

    expect(await prisma.portfolioItem.count({ where: { user_id: user.id } })).toBe(2);

    // Delete roleA
    await prisma.role.delete({ where: { id: roleA.id } });

    // Item attached to roleA should be deleted, item attached to roleB should remain
    const remainingItems = await prisma.portfolioItem.findMany({ where: { user_id: user.id } });
    expect(remainingItems.length).toBe(1);
    expect(remainingItems[0].role_id).toBe(roleB.id);
    expect(remainingItems[0].title).toBe('Dev Article');
  });

  it('Cascade Deletion: deleting a user must cascade delete all of their portfolio items', async () => {
    const user = await prisma.user.create({
      data: { email: 'userdelete@example.com', username: 'userdeletetester' },
    });

    const role = await prisma.role.create({
      data: { user_id: user.id, title: 'Consultant' },
    });

    await prisma.portfolioItem.create({
      data: {
        user_id: user.id,
        role_id: role.id,
        kind: PortfolioItemKind.course,
        title: 'Consulting 101',
        url: 'https://example.com/course',
      },
    });

    expect(await prisma.portfolioItem.count({ where: { user_id: user.id } })).toBe(1);

    // Delete user
    await prisma.user.delete({ where: { id: user.id } });

    // Items should be 0
    expect(await prisma.portfolioItem.count({ where: { user_id: user.id } })).toBe(0);
  });
});
