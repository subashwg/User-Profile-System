import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly avatarsDir: string;
  private readonly coversDir: string;

  constructor() {
    this.avatarsDir = path.resolve(process.cwd(), 'uploads', 'avatars');
    this.coversDir = path.resolve(process.cwd(), 'uploads', 'covers');
    this.ensureDirectoryExists(this.avatarsDir);
    this.ensureDirectoryExists(this.coversDir);
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getAvatarsDir(): string {
    return this.avatarsDir;
  }

  async saveAvatar(buffer: Buffer): Promise<string> {
    this.ensureDirectoryExists(this.avatarsDir);
    const filename = `${randomUUID()}.webp`;
    const filePath = path.join(this.avatarsDir, filename);

    await fs.promises.writeFile(filePath, buffer);
    this.logger.log(`Saved avatar image: ${filename}`);

    return `/uploads/avatars/${filename}`;
  }

  async deleteAvatar(avatarUrl: string | null | undefined): Promise<boolean> {
    if (!avatarUrl || !avatarUrl.includes('/uploads/avatars/')) {
      return false;
    }

    try {
      const filename = path.basename(avatarUrl);
      const filePath = path.join(this.avatarsDir, filename);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`Deleted avatar image: ${filename}`);
        return true;
      }
    } catch (err) {
      this.logger.error(`Failed to delete avatar image: ${(err as Error).message}`);
    }

    return false;
  }

  getAvatarFilePath(filename: string): string | null {
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.avatarsDir, safeFilename);

    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  getCoversDir(): string {
    return this.coversDir;
  }

  async saveCover(
    fullBuffer: Buffer,
    thumbBuffer: Buffer,
  ): Promise<{ coverUrl: string; thumbUrl: string }> {
    this.ensureDirectoryExists(this.coversDir);
    const id = randomUUID();
    const fullFilename = `${id}.webp`;
    const thumbFilename = `${id}-thumb.webp`;

    const fullPath = path.join(this.coversDir, fullFilename);
    const thumbPath = path.join(this.coversDir, thumbFilename);

    await Promise.all([
      fs.promises.writeFile(fullPath, fullBuffer),
      fs.promises.writeFile(thumbPath, thumbBuffer),
    ]);

    this.logger.log(`Saved cover images: ${fullFilename} and ${thumbFilename}`);

    return {
      coverUrl: `/uploads/covers/${fullFilename}`,
      thumbUrl: `/uploads/covers/${thumbFilename}`,
    };
  }

  async deleteCover(coverUrl: string | null | undefined): Promise<boolean> {
    if (!coverUrl || !coverUrl.includes('/uploads/covers/')) {
      return false;
    }

    try {
      const filename = path.basename(coverUrl);
      const id = filename.replace('-thumb.webp', '').replace('.webp', '');

      const fullPath = path.join(this.coversDir, `${id}.webp`);
      const thumbPath = path.join(this.coversDir, `${id}-thumb.webp`);

      let deleted = false;
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        deleted = true;
      }
      if (fs.existsSync(thumbPath)) {
        await fs.promises.unlink(thumbPath);
        deleted = true;
      }

      if (deleted) {
        this.logger.log(`Deleted cover images for id: ${id}`);
      }
      return deleted;
    } catch (err) {
      this.logger.error(`Failed to delete cover image: ${(err as Error).message}`);
    }

    return false;
  }

  getCoverFilePath(filename: string): string | null {
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.coversDir, safeFilename);

    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }
}
