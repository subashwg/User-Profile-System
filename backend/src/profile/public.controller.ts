import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
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

  private async getCallerUserId(req: Request): Promise<string | null> {
    const sessionId = req.cookies?.['session_id'];
    if (sessionId && typeof sessionId === 'string') {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });
      if (session && session.expires_at > new Date()) {
        return session.user_id;
      }
    }
    return null;
  }

  @Get(':username')
  @UseGuards(RateLimitGuard)
  async getPublicProfile(
    @Param('username') username: string,
    @Req() req: Request,
  ) {
    const callerUserId = await this.getCallerUserId(req);
    return this.profileService.getPublicProfile(username, callerUserId);
  }

  @Get(':username/items')
  @UseGuards(RateLimitGuard)
  async getPublicItems(
    @Param('username') username: string,
    @Query('role') role: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Req() req: Request,
  ) {
    const callerUserId = await this.getCallerUserId(req);
    return this.profileService.getPublicItems(
      username,
      {
        role,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
      callerUserId,
    );
  }
}
