import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RESERVED_USERNAMES } from '../users/users.service.js';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto.js';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    const normalizedName = dto.name.trim();
    const normalizedUsername = dto.username.trim().toLowerCase();

    if (RESERVED_USERNAMES.has(normalizedUsername)) {
      throw new BadRequestException('This username is reserved');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedUsername,
          mode: 'insensitive',
        },
      },
    });

    if (existing && existing.id !== userId) {
      throw new ConflictException('Username is already taken');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: normalizedName,
        username: normalizedUsername,
        onboarding_completed: true,
      },
      select: {
        id: true,
        email: true,
        email_verified: true,
        name: true,
        username: true,
        avatar_url: true,
        onboarding_completed: true,
        created_at: true,
        last_login_at: true,
        login_methods: {
          select: {
            id: true,
            type: true,
            created_at: true,
          },
        },
      },
    });

    return {
      message: 'Onboarding completed',
      user: updatedUser,
    };
  }
}
