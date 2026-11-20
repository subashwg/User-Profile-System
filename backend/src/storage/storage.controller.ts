import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service.js';

@Controller('uploads')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('avatars/:filename')
  getAvatar(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.storageService.getAvatarFilePath(filename);
    if (!filePath) {
      throw new NotFoundException('Avatar not found');
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  }

  @Get('covers/:filename')
  getCover(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.storageService.getCoverFilePath(filename);
    if (!filePath) {
      throw new NotFoundException('Cover image not found');
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  }
}
