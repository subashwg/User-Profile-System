import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { StorageService } from '../../storage/storage.service.js';
import { PreviewService } from './preview.service.js';

export const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates real magic bytes for JPEG, PNG, and WebP formats
 */
export function isValidCoverMagicBytes(buffer: Buffer): boolean {
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
export class CoverService {
  private readonly logger = new Logger(CoverService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly previewService: PreviewService,
  ) {}

  /**
   * Process raw image buffer:
   * 1. Validate magic bytes & sharp metadata
   * 2. Crop to 16:9 ratio and create 1280x720 and 640x360 WebP variants
   */
  async processCoverImage(buffer: Buffer): Promise<{
    fullBuffer: Buffer;
    thumbBuffer: Buffer;
  }> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Cover image file is required');
    }

    if (buffer.length > MAX_COVER_SIZE) {
      throw new BadRequestException('Cover image size must not exceed 5MB');
    }

    if (!isValidCoverMagicBytes(buffer)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
        throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
      }

      // Crop to 16:9 and resize to 1280 x 720
      const fullBuffer = await sharp(buffer)
        .resize(1280, 720, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 85 })
        .toBuffer();

      // Crop to 16:9 and resize to 640 x 360 (grid version)
      const thumbBuffer = await sharp(buffer)
        .resize(640, 360, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 80 })
        .toBuffer();

      return { fullBuffer, thumbBuffer };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid or corrupt image file content');
    }
  }

  /**
   * Safely download and process remote cover image (from link preview)
   * Prevents SSRF, enforces 5s timeout & 5MB size limit, stores locally.
   */
  async downloadAndProcessRemoteCover(
    remoteUrl: string,
  ): Promise<{ coverUrl: string; thumbUrl: string } | null> {
    try {
      const parsed = new URL(remoteUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }

      // SSRF validation
      await this.previewService.validateHostSafety(parsed.hostname);

      const response = await fetch(remoteUrl, {
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'PortfolioBot/1.0 (+https://userprofile.dev)',
          Accept: 'image/webp,image/png,image/jpeg,image/*;q=0.8',
        },
      });

      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_COVER_SIZE || !isValidCoverMagicBytes(buffer)) {
        return null;
      }

      const { fullBuffer, thumbBuffer } = await this.processCoverImage(buffer);
      return await this.storageService.saveCover(fullBuffer, thumbBuffer);
    } catch (err) {
      this.logger.warn(`Failed to safely download remote cover: ${(err as Error).message}`);
      return null;
    }
  }
}
