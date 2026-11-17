import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  private readonly sessionDurationMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
}
