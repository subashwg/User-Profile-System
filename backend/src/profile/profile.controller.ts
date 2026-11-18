import 'multer';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { RateLimitGuard } from '../common/guards/rate-limit.guard.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ProfileService } from './profile.service.js';

interface RequestWithAuth extends Request {
  user: {
    id: string;
    email: string;
    email_verified: boolean;
    name: string | null;
    username: string | null;
  };
  session: {
    id: string;
  };
}

@Controller('profile')
@UseGuards(SessionAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  async getMyProfile(@Req() req: RequestWithAuth) {
    return this.profileService.getMyProfile(req.user.id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMyProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Req() req: RequestWithAuth,
  ) {
    return this.profileService.updateMyProfile(req.user.id, updateProfileDto);
  }

  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async uploadAvatar(
    @Req() req: RequestWithAuth,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const file = files?.[0];
    return this.profileService.uploadAvatar(req.user.id, file);
  }

  @Delete('avatar')
  @HttpCode(HttpStatus.OK)
  async deleteAvatar(@Req() req: RequestWithAuth) {
    return this.profileService.deleteAvatar(req.user.id);
  }
}
