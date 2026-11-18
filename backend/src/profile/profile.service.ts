import 'multer';
import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

function sanitizePlainText(text?: string | null): string | null {
  if (text === undefined || text === null) return null;
  // Strip HTML/script tags and trim whitespace
  const sanitized = text.replace(/<[^>]*>?/gm, '').trim();
  return sanitized.length > 0 ? sanitized : null;
}

function isValidImageMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) return true;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  if (isPng) return true;

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  const isRiff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46;
  const isWebp =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  if (isRiff && isWebp) return true;

  return false;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

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
      effective_avatar_url: profile.avatar_url || profile.user?.avatar_url || null,
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
      effective_avatar_url: updatedProfile.avatar_url || updatedProfile.user?.avatar_url || null,
      roles,
    };
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Avatar file is required');
    }

    if (file.buffer.length > MAX_AVATAR_SIZE) {
      throw new BadRequestException('Image size must not exceed 2MB');
    }

    if (!isValidImageMagicBytes(file.buffer)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    let processedBuffer: Buffer;
    try {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();

      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
        throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
      }

      processedBuffer = await image
        .resize(512, 512, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid image file content');
    }

    // Ensure profile exists
    const profile = await this.prisma.profile.findUnique({
      where: { user_id: userId },
    });

    if (profile?.avatar_url) {
      await this.storageService.deleteAvatar(profile.avatar_url);
    }

    const avatarUrl = await this.storageService.saveAvatar(processedBuffer);

    await this.prisma.profile.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        avatar_url: avatarUrl,
        status: 'draft',
      },
      update: {
        avatar_url: avatarUrl,
      },
    });

    return {
      avatar_url: avatarUrl,
      effective_avatar_url: avatarUrl,
    };
  }

  async deleteAvatar(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { user_id: userId },
      include: {
        user: {
          select: {
            avatar_url: true,
          },
        },
      },
    });

    if (profile?.avatar_url) {
      await this.storageService.deleteAvatar(profile.avatar_url);
      await this.prisma.profile.update({
        where: { user_id: userId },
        data: { avatar_url: null },
      });
    }

    return {
      avatar_url: null,
      effective_avatar_url: profile?.user?.avatar_url || null,
    };
  }
}
