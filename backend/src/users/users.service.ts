import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'api',
  'app',
  'login',
  'logout',
  'signin',
  'signout',
  'signup',
  'register',
  'auth',
  'oauth',
  'onboarding',
  'profile',
  'profiles',
  'account',
  'settings',
  'dashboard',
  'root',
  'support',
  'help',
  'about',
  'terms',
  'privacy',
  'status',
  'health',
  'user',
  'users',
  'null',
  'undefined',
  'system',
  'security',
  'billing',
  'mail',
  'dev',
  'test',
  'www',
]);

export const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async checkUsernameAvailable(
    username: string,
    currentUserId: string,
  ): Promise<{ available: boolean; reason?: string }> {
    if (!username || typeof username !== 'string') {
      return { available: false, reason: 'Username is required' };
    }

    const normalized = username.trim().toLowerCase();

    if (normalized.length < 3) {
      return { available: false, reason: 'Username must be at least 3 characters long' };
    }

    if (normalized.length > 30) {
      return { available: false, reason: 'Username must be at most 30 characters long' };
    }

    if (!USERNAME_REGEX.test(normalized)) {
      return {
        available: false,
        reason: 'Username can only contain lowercase letters, numbers, and underscores',
      };
    }

    if (RESERVED_USERNAMES.has(normalized)) {
      return { available: false, reason: 'This username is reserved' };
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        username: {
          equals: normalized,
          mode: 'insensitive',
        },
      },
    });

    if (existingUser && existingUser.id !== currentUserId) {
      return { available: false, reason: 'Username is already taken' };
    }

    return { available: true };
  }
}
