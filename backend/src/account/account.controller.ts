import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { AccountService } from './account.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LinkProviderDto } from './dto/link-provider.dto.js';

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

@Controller('account')
@UseGuards(SessionAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('login-methods')
  async getLoginMethods(@Req() req: RequestWithAuth) {
    return this.accountService.getLoginMethods(req.user.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: RequestWithAuth,
  ) {
    return this.accountService.changePassword(
      req.user.id,
      req.session.id,
      changePasswordDto,
    );
  }

  @Post('link/google')
  @HttpCode(HttpStatus.OK)
  async linkGoogle(
    @Body() linkProviderDto: LinkProviderDto,
    @Req() req: RequestWithAuth,
  ) {
    return this.accountService.linkGoogle(
      req.user.id,
      linkProviderDto.credential,
    );
  }

  @Post('link/apple')
  @HttpCode(HttpStatus.OK)
  async linkApple(
    @Body() linkProviderDto: LinkProviderDto,
    @Req() req: RequestWithAuth,
  ) {
    return this.accountService.linkApple(
      req.user.id,
      linkProviderDto.credential,
    );
  }
}
