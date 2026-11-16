import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to the database successfully.');
    } catch (error) {
      this.logger.warn(`Initial database connection attempt failed: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from the database.');
    } catch (error) {
      this.logger.warn(`Database disconnect error: ${(error as Error).message}`);
    }
  }

  async isHealthy(timeoutMs = 2000): Promise<boolean> {
    try {
      const queryPromise = this.$queryRaw`SELECT 1`;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database health check timed out')), timeoutMs),
      );

      await Promise.race([queryPromise, timeoutPromise]);
      return true;
    } catch {
      return false;
    }
  }
}
