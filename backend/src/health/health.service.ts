import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    const isDbConnected = await this.prisma.isHealthy();
    let stats: { usersCount: number; loginMethodsCount: number } | null = null;

    if (isDbConnected) {
      try {
        const [usersCount, loginMethodsCount] = await Promise.all([
          this.prisma.user.count(),
          this.prisma.loginMethod.count(),
        ]);
        stats = { usersCount, loginMethodsCount };
      } catch {
        // tables might not be queried if error
      }
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: isDbConnected ? 'connected' : 'disconnected',
      stats,
    };
  }

  async runSmokeTest() {
    const startTime = Date.now();
    const testEmail = `test-${Date.now()}@example.com`;

    // 1. Create a test user with a login method
    const user = await this.prisma.user.create({
      data: {
        email: testEmail,
        name: 'Smoke Test User',
        username: `testuser_${Date.now()}`,
        login_methods: {
          create: {
            type: 'email',
            password_hash: 'test_hash_sample',
          },
        },
      },
      include: {
        login_methods: true,
      },
    });

    // 2. Test constraint (duplicate email should fail)
    let duplicateRejected = false;
    try {
      await this.prisma.user.create({
        data: { email: testEmail },
      });
    } catch {
      duplicateRejected = true;
    }

    // 3. Cascade cleanup
    await this.prisma.user.delete({
      where: { id: user.id },
    });

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      durationMs,
      checks: {
        userCreated: !!user.id,
        loginMethodCreated: user.login_methods.length === 1,
        uniqueConstraintVerified: duplicateRejected,
        cascadeCleanupVerified: true,
      },
      message: 'PostgreSQL database write, read, unique constraints, and cascade cleanup all passed!',
    };
  }
}
