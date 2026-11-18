import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

function sanitizePlainText(text?: string | null): string | null {
  if (text === undefined || text === null) return null;
  // Strip HTML/script tags and trim whitespace
  const sanitized = text.replace(/<[^>]*>?/gm, '').trim();
  return sanitized.length > 0 ? sanitized : null;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string) {
    let profile = await this.prisma.profile.findUnique({
      where: { user_id: userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar_url: true,
          },
        },
      },
    });

    if (!profile) {
      // Ensure profile exists for the user
      profile = await this.prisma.profile.create({
        data: {
          user_id: userId,
          status: 'draft',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              avatar_url: true,
            },
          },
        },
      });
    }

    const roles = await this.prisma.role.findMany({
      where: { user_id: userId },
      orderBy: { position: 'asc' },
      include: {
        skills: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return {
      ...profile,
      roles,
    };
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDto) {
    // Ensure profile exists first
    await this.getMyProfile(userId);

    const updateData: {
      headline?: string | null;
      bio?: string | null;
      location?: string | null;
    } = {};

    if (dto.headline !== undefined) {
      updateData.headline = sanitizePlainText(dto.headline);
    }
    if (dto.bio !== undefined) {
      updateData.bio = sanitizePlainText(dto.bio);
    }
    if (dto.location !== undefined) {
      updateData.location = sanitizePlainText(dto.location);
    }

    const updatedProfile = await this.prisma.profile.update({
      where: { user_id: userId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar_url: true,
          },
        },
      },
    });

    const roles = await this.prisma.role.findMany({
      where: { user_id: userId },
      orderBy: { position: 'asc' },
      include: {
        skills: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return {
      ...updatedProfile,
      roles,
    };
  }
}
