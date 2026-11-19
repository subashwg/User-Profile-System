import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimitGuard } from '../common/guards/rate-limit.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfileService } from './profile.service.js';

@Controller('public')
export class PublicController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':username')
  @UseGuards(RateLimitGuard)
  async getPublicProfile(
    @Param('username') username: string,
    @Req() req: Request,
  ) {
    let callerUserId: string | null = null;
    const sessionId = req.cookies?.['session_id'];

    if (sessionId && typeof sessionId === 'string') {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });
      if (session && session.expires_at > new Date()) {
        callerUserId = session.user_id;
      }
    }

    return this.profileService.getPublicProfile(username, callerUserId);
  }
}
