import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { GoogleService, type GoogleUserInfo } from './google/google.service.js';

@Injectable()
export class AuthService {
  private readonly sessionDurationMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly googleService: GoogleService,
  ) {
    const maxAgeDays = this.configService.get<number>('SESSION_MAX_AGE_DAYS', 30);
    this.sessionDurationMs = maxAgeDays * 24 * 60 * 60 * 1000;
  }

  async register(registerDto: RegisterDto, userAgent?: string, ip?: string) {
    const email = registerDto.email.trim().toLowerCase();

    // Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // Hash password with argon2
    const passwordHash = await argon2.hash(registerDto.password);

    try {
      // Create user and email login method in a transaction
      const user = await this.prisma.user.create({
        data: {
          email,
          email_verified: false,
          onboarding_completed: false,
          login_methods: {
            create: {
              type: 'email',
              password_hash: passwordHash,
            },
          },
        },
        select: {
          id: true,
          email: true,
          email_verified: true,
          name: true,
          username: true,
          avatar_url: true,
          onboarding_completed: true,
          created_at: true,
          last_login_at: true,
        },
      });

      // Create initial session
      const session = await this.createSession(user.id, userAgent, ip);

      // Generate verification email token and send link
      const rawToken = await this.createEmailToken(user.id, 'verify_email', 24 * 60 * 60 * 1000);
      await this.mailService.sendVerificationEmail(user.email, rawToken);

      return {
        user,
        sessionId: session.id,
        expiresAt: session.expires_at,
      };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw new InternalServerErrorException('Failed to register user');
    }
  }

  async login(loginDto: LoginDto, userAgent?: string, ip?: string) {
    const email = loginDto.email.trim().toLowerCase();

    // Generic error message per security rules
    const invalidCredentialsError = new UnauthorizedException('Invalid email or password.');

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        login_methods: {
          where: { type: 'email' },
        },
      },
    });

    if (!user || user.deleted_at) {
      throw invalidCredentialsError;
    }

    const emailLoginMethod = user.login_methods[0];
    if (!emailLoginMethod || !emailLoginMethod.password_hash) {
      throw invalidCredentialsError;
    }

    const isPasswordValid = await argon2.verify(
      emailLoginMethod.password_hash,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw invalidCredentialsError;
    }

    // Update last_login_at
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
      select: {
        id: true,
        email: true,
        email_verified: true,
        name: true,
        username: true,
        avatar_url: true,
        onboarding_completed: true,
        created_at: true,
        last_login_at: true,
      },
    });

    // Create session
    const session = await this.createSession(user.id, userAgent, ip);

    return {
      user: updatedUser,
      sessionId: session.id,
      expiresAt: session.expires_at,
    };
  }

  async logout(sessionId: string) {
    if (sessionId) {
      await this.prisma.session.deleteMany({
        where: { id: sessionId },
      });
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        email_verified: true,
        name: true,
        username: true,
        avatar_url: true,
        onboarding_completed: true,
        created_at: true,
        last_login_at: true,
        login_methods: {
          select: {
            id: true,
            type: true,
            created_at: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async verifyEmail(rawToken: string) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException('Invalid or missing verification token');
    }

    const tokenHash = this.hashToken(rawToken);

    const emailToken = await this.prisma.emailToken.findFirst({
      where: {
        token_hash: tokenHash,
        purpose: 'verify_email',
      },
      include: {
        user: true,
      },
    });

    if (!emailToken || emailToken.used_at !== null || emailToken.expires_at < new Date()) {
      throw new BadRequestException('Invalid, expired, or already used verification token');
    }

    // Mark token as used and set email_verified to true
    await this.prisma.$transaction([
      this.prisma.emailToken.update({
        where: { id: emailToken.id },
        data: { used_at: new Date() },
      }),
      this.prisma.user.update({
        where: { id: emailToken.user_id },
        data: { email_verified: true },
      }),
    ]);

    return {
      message: 'Email verified successfully',
      email_verified: true,
    };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.email_verified) {
      throw new BadRequestException('Email is already verified');
    }

    // Invalidate prior unused verify_email tokens for this user
    await this.prisma.emailToken.updateMany({
      where: {
        user_id: userId,
        purpose: 'verify_email',
        used_at: null,
      },
      data: {
        used_at: new Date(),
      },
    });

    // Create new verification token and email it
    const rawToken = await this.createEmailToken(user.id, 'verify_email', 24 * 60 * 60 * 1000);
    await this.mailService.sendVerificationEmail(user.email, rawToken);

    return { message: 'Verification link sent' };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email?.trim().toLowerCase();
    const genericResponse = { message: 'If this email exists, we sent a link' };

    if (!normalizedEmail) {
      return genericResponse;
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.deleted_at) {
      return genericResponse;
    }

    // Invalidate prior unused reset_password tokens for this user
    await this.prisma.emailToken.updateMany({
      where: {
        user_id: user.id,
        purpose: 'reset_password',
        used_at: null,
      },
      data: {
        used_at: new Date(),
      },
    });

    // Create 30-minute password reset token
    const rawToken = await this.createEmailToken(user.id, 'reset_password', 30 * 60 * 1000);
    await this.mailService.sendPasswordResetEmail(user.email, rawToken);

    return genericResponse;
  }

  async resetPassword(rawToken: string, newPassword: string) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException('Invalid or missing password reset token');
    }

    const tokenHash = this.hashToken(rawToken);

    const emailToken = await this.prisma.emailToken.findFirst({
      where: {
        token_hash: tokenHash,
        purpose: 'reset_password',
      },
    });

    if (!emailToken || emailToken.used_at !== null || emailToken.expires_at < new Date()) {
      throw new BadRequestException('Invalid, expired, or already used password reset token');
    }

    // Hash new password with argon2
    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction([
      // 1. Mark token used
      this.prisma.emailToken.update({
        where: { id: emailToken.id },
        data: { used_at: new Date() },
      }),
      // 2. Update password hash on email login method
      this.prisma.loginMethod.updateMany({
        where: {
          user_id: emailToken.user_id,
          type: 'email',
        },
        data: {
          password_hash: passwordHash,
        },
      }),
      // 3. End all existing sessions for that user
      this.prisma.session.deleteMany({
        where: { user_id: emailToken.user_id },
      }),
    ]);

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  async loginWithGoogle(code: string, userAgent?: string, ip?: string) {
    const googleUser = await this.googleService.verifyCodeAndGetUserInfo(code);
    return this.handleGoogleUser(googleUser, userAgent, ip);
  }

  async handleGoogleUser(googleUser: GoogleUserInfo, userAgent?: string, ip?: string) {
    const normalizedEmail = googleUser.email.trim().toLowerCase();

    // 1. Check if a LoginMethod already exists with this Google provider ID
    const existingGoogleMethod = await this.prisma.loginMethod.findFirst({
      where: {
        type: 'google',
        provider_user_id: googleUser.sub,
      },
      include: {
        user: true,
      },
    });

    if (existingGoogleMethod) {
      if (existingGoogleMethod.user.deleted_at) {
        throw new UnauthorizedException('Account is inactive');
      }

      // Update avatar or email_verified if newly confirmed by Google
      const updateData: { last_login_at: Date; avatar_url?: string; email_verified?: boolean } = {
        last_login_at: new Date(),
      };
      if (googleUser.picture && !existingGoogleMethod.user.avatar_url) {
        updateData.avatar_url = googleUser.picture;
      }
      if (googleUser.email_verified && !existingGoogleMethod.user.email_verified) {
        updateData.email_verified = true;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: existingGoogleMethod.user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          email_verified: true,
          name: true,
          username: true,
          avatar_url: true,
          onboarding_completed: true,
          created_at: true,
          last_login_at: true,
        },
      });

      const session = await this.createSession(updatedUser.id, userAgent, ip);
      return {
        user: updatedUser,
        sessionId: session.id,
        expiresAt: session.expires_at,
      };
    }

    // 2. Provider ID is new: Apply the Linking Rule
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (existingUser.deleted_at) {
        throw new UnauthorizedException('Account is inactive');
      }

      // 2.1. Provider confirms email is verified -> link Google login method to existing user
      if (googleUser.email_verified) {
        await this.prisma.$transaction([
          this.prisma.loginMethod.create({
            data: {
              user_id: existingUser.id,
              type: 'google',
              provider_user_id: googleUser.sub,
            },
          }),
          this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              email_verified: true, // Confirmed by Google
              last_login_at: new Date(),
              avatar_url: existingUser.avatar_url || googleUser.picture || null,
              name: existingUser.name || googleUser.name || null,
            },
          }),
        ]);

        const freshUser = await this.prisma.user.findUniqueOrThrow({
          where: { id: existingUser.id },
          select: {
            id: true,
            email: true,
            email_verified: true,
            name: true,
            username: true,
            avatar_url: true,
            onboarding_completed: true,
            created_at: true,
            last_login_at: true,
          },
        });

        const session = await this.createSession(freshUser.id, userAgent, ip);
        return {
          user: freshUser,
          sessionId: session.id,
          expiresAt: session.expires_at,
        };
      } else {
        // 2.2. Email exists but provider does not confirm it as verified -> DO NOT MERGE!
        throw new ConflictException(
          'An account with this email already exists. Please log in with your original method first.',
        );
      }
    }

    // 2.3. No user with this email -> create new User and Google LoginMethod, then start onboarding
    const newUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        email_verified: googleUser.email_verified,
        name: googleUser.name || null,
        avatar_url: googleUser.picture || null,
        onboarding_completed: false,
        last_login_at: new Date(),
        login_methods: {
          create: {
            type: 'google',
            provider_user_id: googleUser.sub,
          },
        },
      },
      select: {
        id: true,
        email: true,
        email_verified: true,
        name: true,
        username: true,
        avatar_url: true,
        onboarding_completed: true,
        created_at: true,
        last_login_at: true,
      },
    });

    const session = await this.createSession(newUser.id, userAgent, ip);
    return {
      user: newUser,
      sessionId: session.id,
      expiresAt: session.expires_at,
    };
  }

  private async createSession(userId: string, userAgent?: string, ip?: string) {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.sessionDurationMs);

    return this.prisma.session.create({
      data: {
        id: sessionId,
        user_id: userId,
        expires_at: expiresAt,
        user_agent: userAgent,
        ip,
      },
    });
  }

  private async createEmailToken(userId: string, purpose: 'verify_email' | 'reset_password', ttlMs: number): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.prisma.emailToken.create({
      data: {
        user_id: userId,
        purpose,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    return rawToken;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
