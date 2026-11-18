import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly avatarsDir: string;

  constructor() {
    this.avatarsDir = path.resolve(process.cwd(), 'uploads', 'avatars');
    this.ensureDirectoryExists(this.avatarsDir);
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
}
