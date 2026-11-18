import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service.js';

@Controller('uploads/avatars')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get(':filename')
  getAvatar(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.storageService.getAvatarFilePath(filename);
    if (!filePath) {
      throw new NotFoundException('Avatar not found');
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  }
}
