import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';

interface RequestWithAuth extends Request {
  user: { id: string; email: string };
  session: { id: string };
}

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    const result = await this.authService.register(registerDto, userAgent, ip);

    this.setSessionCookie(res, result.sessionId, result.expiresAt);

    return {
      message: 'Registration successful',
      user: result.user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    const result = await this.authService.login(loginDto, userAgent, ip);

    this.setSessionCookie(res, result.sessionId, result.expiresAt);

    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async logout(
    @Req() req: RequestWithAuth,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.session.id);
    this.clearSessionCookie(res);

    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async getMe(@Req() req: RequestWithAuth) {
    const user = await this.authService.getMe(req.user.id);
    return { user };
  }

  private setSessionCookie(res: Response, sessionId: string, expires: Date) {
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      expires,
      path: '/',
    });
  }

  private clearSessionCookie(res: Response) {
    res.clearCookie('session_id', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }
}
