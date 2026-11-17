import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { AppleService } from './apple/apple.service.js';
import { GoogleService } from './google/google.service.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';
import { RateLimitGuard } from '../common/guards/rate-limit.guard.js';

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
    private readonly googleService: GoogleService,
    private readonly appleService: AppleService,
  ) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  @Post('register')
  @UseGuards(RateLimitGuard)
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
  @UseGuards(RateLimitGuard)
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

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, RateLimitGuard)
  async resendVerification(@Req() req: RequestWithAuth) {
    return this.authService.resendVerification(req.user.id);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  @Get('google')
  async googleAuth(@Res() res: Response) {
    const state = randomBytes(32).toString('hex');

    res.cookie('oauth_google_state', state, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/',
    });

    const authUrl = this.googleService.generateAuthUrl(state);
    return res.redirect(authUrl);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
    @Ip() ip: string,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const savedState = req.cookies?.oauth_google_state;

    // Clear state cookie
    res.clearCookie('oauth_google_state', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/',
    });

    if (error) {
      return res.redirect(`${frontendUrl}?error=${encodeURIComponent(error)}`);
    }

    if (!state || !savedState || state !== savedState) {
      return res.redirect(
        `${frontendUrl}?error=${encodeURIComponent('Invalid OAuth state. Please try again.')}`,
      );
    }

    if (!code) {
      return res.redirect(
        `${frontendUrl}?error=${encodeURIComponent('Missing authorization code from Google')}`,
      );
    }

    try {
      const userAgent = req.headers['user-agent'] as string | undefined;
      const result = await this.authService.loginWithGoogle(code, userAgent, ip);
      this.setSessionCookie(res, result.sessionId, result.expiresAt);
      return res.redirect(frontendUrl);
    } catch (err) {
      return res.redirect(
        `${frontendUrl}?error=${encodeURIComponent((err as Error).message)}`,
      );
    }
  }

  @Get('apple')
  async appleAuth(@Res() res: Response) {
    const state = randomBytes(32).toString('hex');

    res.cookie('oauth_apple_state', state, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/',
    });

    const authUrl = this.appleService.generateAuthUrl(state);
    return res.redirect(authUrl);
  }

  @Post('apple/callback')
  async appleCallback(
    @Body() body: Record<string, any>,
    @Req() req: Request,
    @Res() res: Response,
    @Ip() ip: string,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const savedState = req.cookies?.oauth_apple_state;

    // Clear the OAuth state cookie
    res.clearCookie('oauth_apple_state', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/',
    });

    const state = body?.state;
    const error = body?.error;
    const idToken = body?.id_token;
    const userPayload = body?.user;

    if (error) {
      return res.redirect(`${frontendUrl}?error=${encodeURIComponent(error)}`);
    }

    if (!state || !savedState || state !== savedState) {
      return res.redirect(
        `${frontendUrl}?error=${encodeURIComponent('Invalid OAuth state. Please try again.')}`,
      );
    }

    if (!idToken) {
      return res.redirect(
        `${frontendUrl}?error=${encodeURIComponent('Missing Apple ID token')}`,
      );
    }

    try {
      const userAgent = req.headers['user-agent'] as string | undefined;
      const result = await this.authService.loginWithApple(
        idToken,
        userPayload,
        userAgent,
        ip,
      );
      this.setSessionCookie(res, result.sessionId, result.expiresAt);
      return res.redirect(frontendUrl);
    } catch (err) {
      return res.redirect(
        `${frontendUrl}?error=${encodeURIComponent((err as Error).message)}`,
      );
    }
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
