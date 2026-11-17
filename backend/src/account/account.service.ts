import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AppleService } from '../auth/apple/apple.service.js';
import { GoogleService } from '../auth/google/google.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleService: GoogleService,
    private readonly appleService: AppleService,
  ) {}

  async getLoginMethods(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
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

    return {
      email: user.email,
      login_methods: user.login_methods.map((method) => ({
        id: method.id,
        type: method.type,
        created_at: method.created_at,
        email: user.email,
      })),
    };
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    dto: ChangePasswordDto,
  ) {
    const emailLoginMethod = await this.prisma.loginMethod.findFirst({
      where: {
        user_id: userId,
        type: 'email',
      },
    });

    if (!emailLoginMethod || !emailLoginMethod.password_hash) {
      throw new BadRequestException(
        'This account does not have a password set. You may be using social login.',
      );
    }

    const isMatch = await argon2.verify(
      emailLoginMethod.password_hash,
      dto.currentPassword,
    );

    if (!isMatch) {
      throw new UnauthorizedException('Current password does not match');
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.loginMethod.update({
        where: { id: emailLoginMethod.id },
        data: { password_hash: newPasswordHash },
      }),
      // Revoke all other sessions for this user for security
      this.prisma.session.deleteMany({
        where: {
          user_id: userId,
          id: { not: currentSessionId },
        },
      }),
    ]);

    return { message: 'Password changed successfully' };
  }

  async linkGoogle(userId: string, credential: string) {
    const googleUser = await this.googleService.verifyCodeAndGetUserInfo(credential);

    const existingMethod = await this.prisma.loginMethod.findFirst({
      where: {
        type: 'google',
        provider_user_id: googleUser.sub,
      },
    });

    if (existingMethod) {
      if (existingMethod.user_id === userId) {
        return { message: 'Google account is already linked to your profile' };
      }
      throw new ConflictException(
        'This Google account is already linked to another user profile',
      );
    }

    await this.prisma.loginMethod.create({
      data: {
        user_id: userId,
        type: 'google',
        provider_user_id: googleUser.sub,
      },
    });

    return { message: 'Google account linked successfully' };
  }

  async linkApple(userId: string, credential: string) {
    const appleUser = await this.appleService.verifyIdToken(credential);

    const existingMethod = await this.prisma.loginMethod.findFirst({
      where: {
        type: 'apple',
        provider_user_id: appleUser.sub,
      },
    });

    if (existingMethod) {
      if (existingMethod.user_id === userId) {
        return { message: 'Apple account is already linked to your profile' };
      }
      throw new ConflictException(
        'This Apple account is already linked to another user profile',
      );
    }

    await this.prisma.loginMethod.create({
      data: {
        user_id: userId,
        type: 'apple',
        provider_user_id: appleUser.sub,
      },
    });

    return { message: 'Apple account linked successfully' };
  }
}
