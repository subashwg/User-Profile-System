import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let healthController: HealthController;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            isHealthy: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    healthController = module.get<HealthController>(HealthController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should return health status with database connected', async () => {
    const result = await healthController.getHealth();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should return database disconnected if health check fails', async () => {
    vi.spyOn(prismaService, 'isHealthy').mockResolvedValue(false);
    const result = await healthController.getHealth();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('disconnected');
  });
});
