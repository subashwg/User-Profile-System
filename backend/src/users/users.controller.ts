import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { UsersService } from './users.service.js';

interface RequestWithAuth extends Request {
  user: {
    id: string;
    email: string;
    email_verified: boolean;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    onboarding_completed: boolean;
  };
  session: {
    id: string;
  };
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('username-available')
  @UseGuards(SessionAuthGuard)
  async checkUsernameAvailable(
    @Query('username') username: string,
    @Req() req: RequestWithAuth,
  ) {
    return this.usersService.checkUsernameAvailable(username, req.user.id);
  }
}
