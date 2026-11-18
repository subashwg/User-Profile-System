import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Step 2 Database: Profile, Roles & Skills', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.skill.deleteMany({});
    await prisma.role.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.emailToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.loginMethod.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('Happy Path: should create user, profile, roles and skills with correct relations and defaults', async () => {
    // 1. Create a user
    const user = await prisma.user.create({
      data: {
        email: 'creator@example.com',
        name: 'Alex Creator',
        username: 'alexcreator',
        onboarding_completed: true,
      },
    });

    // 2. Create profile with default draft status
    const profile = await prisma.profile.create({
      data: {
        user_id: user.id,
        headline: 'Senior Full Stack Engineer & Content Creator',
        bio: 'Building modern web applications and sharing development insights.',
        location: 'Kathmandu, Nepal',
      },
    });

    expect(profile.status).toBe('draft');
    expect(profile.published_at).toBeNull();
    expect(profile.user_id).toBe(user.id);
    expect(profile.headline).toBe('Senior Full Stack Engineer & Content Creator');

    // 3. Create roles for user
    const primaryRole = await prisma.role.create({
      data: {
        user_id: user.id,
        title: 'Developer',
        description: 'Building distributed cloud applications',
        position: 0,
        is_primary: true,
      },
    });

    const secondRole = await prisma.role.create({
      data: {
        user_id: user.id,
        title: 'Content Creator',
        description: 'Writing technical blogs and video guides',
        position: 1,
        is_primary: false,
      },
    });

    expect(primaryRole.is_primary).toBe(true);
    expect(secondRole.is_primary).toBe(false);

    // 4. Create skills under primary role
    const skill1 = await prisma.skill.create({
      data: {
        role_id: primaryRole.id,
        name: 'TypeScript',
        position: 0,
      },
    });

    const skill2 = await prisma.skill.create({
      data: {
        role_id: primaryRole.id,
        name: 'NestJS',
        position: 1,
      },
    });

    expect(skill1.role_id).toBe(primaryRole.id);
    expect(skill2.name).toBe('NestJS');

    // 5. Query user with complete profile, roles, and skills
    const userWithAll = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: true,
        roles: {
          orderBy: { position: 'asc' },
          include: {
            skills: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    expect(userWithAll).toBeDefined();
    expect(userWithAll!.profile).toBeDefined();
    expect(userWithAll!.profile!.status).toBe('draft');
    expect(userWithAll!.roles).toHaveLength(2);
    expect(userWithAll!.roles[0].title).toBe('Developer');
    expect(userWithAll!.roles[0].skills).toHaveLength(2);
    expect(userWithAll!.roles[0].skills[0].name).toBe('TypeScript');
  });

  it('Cascade Deletion: deleting a role must cascade delete its skills', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'qa@example.com',
        name: 'QA Lead',
        username: 'qalead',
      },
    });

    const role = await prisma.role.create({
      data: {
        user_id: user.id,
        title: 'QA Engineer',
        is_primary: true,
      },
    });

    await prisma.skill.create({
      data: {
        role_id: role.id,
        name: 'Playwright',
      },
    });

    await prisma.skill.create({
      data: {
        role_id: role.id,
        name: 'Cypress',
      },
    });

    expect(await prisma.skill.count({ where: { role_id: role.id } })).toBe(2);

    // Delete role
    await prisma.role.delete({ where: { id: role.id } });

    // Associated skills should be deleted
    expect(await prisma.skill.count({ where: { role_id: role.id } })).toBe(0);
  });

  it('Cascade Deletion: deleting a user must cascade delete their profile, roles and skills', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'delete-target@example.com',
        username: 'deletetarget',
      },
    });

    const profile = await prisma.profile.create({
      data: {
        user_id: user.id,
        headline: 'To be deleted',
      },
    });

    const role = await prisma.role.create({
      data: {
        user_id: user.id,
        title: 'Temporary Role',
        is_primary: true,
      },
    });

    await prisma.skill.create({
      data: {
        role_id: role.id,
        name: 'Temporary Skill',
      },
    });

    // Delete user
    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.profile.count({ where: { id: profile.id } })).toBe(0);
    expect(await prisma.role.count({ where: { id: role.id } })).toBe(0);
    expect(await prisma.skill.count({ where: { role_id: role.id } })).toBe(0);
  });
});
