import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
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
}
