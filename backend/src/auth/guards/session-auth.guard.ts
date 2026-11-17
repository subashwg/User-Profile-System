import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.cookies?.session_id;

    if (!sessionId || typeof sessionId !== 'string') {
      throw new UnauthorizedException('Authentication required');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
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
            deleted_at: true,
          },
        },
      },
    });

    if (!session || session.expires_at < new Date()) {
      if (session) {
        // Clean up expired session asynchronously
        this.prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
      }
      throw new UnauthorizedException('Session expired or invalid');
    }

    if (session.user.deleted_at) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Attach user and session to request
    (request as unknown as { user: typeof session.user }).user = session.user;
    (request as unknown as { session: typeof session }).session = session;

    return true;
  }
}
