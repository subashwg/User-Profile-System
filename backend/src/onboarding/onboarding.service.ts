import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RESERVED_USERNAMES } from '../users/users.service.js';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto.js';
import { OnboardingRolesDto } from './dto/onboarding-roles.dto.js';

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

    // Ensure Profile record exists for user
    await this.prisma.profile.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        status: 'draft',
      },
      update: {},
    });

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

  async saveOnboardingRoles(userId: string, dto: OnboardingRolesDto) {
    const rolesList = dto.roles || [];

    if (rolesList.length > 5) {
      throw new BadRequestException('A user can have at most 5 roles.');
    }

    // Check for duplicate titles within payload (case-insensitive)
    const seenTitles = new Set<string>();
    for (const r of rolesList) {
      const lower = r.title.trim().toLowerCase();
      if (seenTitles.has(lower)) {
        throw new BadRequestException(`Duplicate role title "${r.title.trim()}" provided.`);
      }
      seenTitles.add(lower);
    }

    // Determine primary index
    let primaryIndex = rolesList.findIndex((r) => r.is_primary === true);
    if (primaryIndex === -1 && rolesList.length > 0) {
      primaryIndex = 0; // First role defaults to primary
    }

    return this.prisma.$transaction(async (tx) => {
      // Ensure empty Profile record exists if not existing yet
      await tx.profile.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          status: 'draft',
        },
        update: {},
      });

      // Clear any prior roles for this user
      await tx.role.deleteMany({
        where: { user_id: userId },
      });

      const createdRoles = [];
      for (let i = 0; i < rolesList.length; i++) {
        const item = rolesList[i];
        const role = await tx.role.create({
          data: {
            user_id: userId,
            title: item.title.trim(),
            description: item.description ? item.description.trim() : null,
            position: i,
            is_primary: i === primaryIndex,
          },
          include: {
            skills: {
              orderBy: { position: 'asc' },
            },
          },
        });
        createdRoles.push(role);
      }

      // Mark onboarding as completed
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { onboarding_completed: true },
        select: {
          id: true,
          email: true,
          email_verified: true,
          name: true,
          username: true,
          avatar_url: true,
          onboarding_completed: true,
        },
      });

      return {
        message: 'Onboarding roles saved successfully',
        roles: createdRoles,
        user: updatedUser,
      };
    });
  }
}
