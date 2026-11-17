import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Database: User and LoginMethod models', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.loginMethod.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('Happy Path: should create a User and an associated email LoginMethod', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'creator@example.com',
        name: 'Jane Creator',
        username: 'janecreator',
        login_methods: {
          create: {
            type: 'email',
            password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          },
        },
      },
      include: {
        login_methods: true,
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('creator@example.com');
    expect(user.email_verified).toBe(false);
    expect(user.onboarding_completed).toBe(false);
    expect(user.login_methods).toHaveLength(1);
    expect(user.login_methods[0].type).toBe('email');
    expect(user.login_methods[0].password_hash).toContain('$argon2id$');
  });

  it('Happy Path: should support linking multiple login methods (email + google) to one User', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'subash@example.com',
        name: 'Subash',
        login_methods: {
          create: [
            {
              type: 'email',
              password_hash: 'hashedpassword',
            },
            {
              type: 'google',
              provider_user_id: 'google-sub-12345',
            },
          ],
        },
      },
      include: {
        login_methods: true,
      },
    });

    expect(user.login_methods).toHaveLength(2);
    const types = user.login_methods.map((m) => m.type);
    expect(types).toContain('email');
    expect(types).toContain('google');
  });

  it('Failure Case: should reject duplicate user emails', async () => {
    await prisma.user.create({
      data: {
        email: 'duplicate@example.com',
      },
    });

    await expect(
      prisma.user.create({
        data: {
          email: 'duplicate@example.com',
        },
      }),
    ).rejects.toThrow();
  });

  it('Failure Case: should reject duplicate usernames', async () => {
    await prisma.user.create({
      data: {
        email: 'user1@example.com',
        username: 'samename',
      },
    });

    await expect(
      prisma.user.create({
        data: {
          email: 'user2@example.com',
          username: 'samename',
        },
      }),
    ).rejects.toThrow();
  });

  it('Failure Case: should reject duplicate (type, provider_user_id) login methods', async () => {
    const user1 = await prisma.user.create({
      data: { email: 'user1@example.com' },
    });
    const user2 = await prisma.user.create({
      data: { email: 'user2@example.com' },
    });

    await prisma.loginMethod.create({
      data: {
        user_id: user1.id,
        type: 'google',
        provider_user_id: 'same-google-id',
      },
    });

    await expect(
      prisma.loginMethod.create({
        data: {
          user_id: user2.id,
          type: 'google',
          provider_user_id: 'same-google-id',
        },
      }),
    ).rejects.toThrow();
  });

  it('Cascade: deleting a user should automatically delete their login methods', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'delete-me@example.com',
        login_methods: {
          create: {
            type: 'apple',
            provider_user_id: 'apple-sub-999',
          },
        },
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    const orphanMethods = await prisma.loginMethod.findMany({
      where: { user_id: user.id },
    });
    expect(orphanMethods).toHaveLength(0);
  });
});
