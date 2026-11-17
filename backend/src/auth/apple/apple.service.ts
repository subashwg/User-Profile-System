import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

export interface AppleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  is_private_email?: boolean;
}

@Injectable()
export class AppleService {
  private readonly logger = new Logger(AppleService.name);
  private readonly clientId: string;
  private readonly callbackUrl: string;
  private readonly appleJwks = createRemoteJWKSet(
    new URL('https://appleid.apple.com/auth/keys'),
  );

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('APPLE_CLIENT_ID') || '';
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    this.callbackUrl =
      this.configService.get<string>('APPLE_CALLBACK_URL') || `${appUrl}/auth/apple/callback`;
  }

  generateAuthUrl(state: string): string {
    const rootUrl = 'https://appleid.apple.com/auth/authorize';
    const params = new URLSearchParams({
      client_id: this.clientId || 'dummy-apple-client-id',
      redirect_uri: this.callbackUrl,
      response_type: 'code id_token',
      scope: 'name email',
      response_mode: 'form_post',
      state,
    });
    return `${rootUrl}?${params.toString()}`;
  }

  async verifyIdToken(
    idToken: string,
    userPayloadRaw?: string | Record<string, any>,
  ): Promise<AppleUserInfo> {
    if (!idToken || typeof idToken !== 'string') {
      throw new BadRequestException('Missing Apple ID token');
    }

    try {
      let payload: Record<string, any>;

      // In production, verify JWT signature against Apple's JWKS
      const isProduction =
        this.configService.get<string>('NODE_ENV') === 'production';

      if (isProduction) {
        const { payload: verifiedPayload } = await jwtVerify(
          idToken,
          this.appleJwks,
          {
            issuer: 'https://appleid.apple.com',
            audience: this.clientId,
          },
        );
        payload = verifiedPayload as Record<string, any>;
      } else {
        // In development/testing, decode claims safely
        payload = decodeJwt(idToken);
      }

      if (!payload || !payload.sub || !payload.email) {
        throw new BadRequestException(
          'Apple ID token missing required subject or email claims',
        );
      }

      // First-time name capture from Apple form_post user object
      let capturedName: string | undefined;
      if (userPayloadRaw) {
        try {
          const userObj =
            typeof userPayloadRaw === 'string'
              ? JSON.parse(userPayloadRaw)
              : userPayloadRaw;
          if (userObj?.name) {
            const parts = [userObj.name.firstName, userObj.name.lastName].filter(
              Boolean,
            );
            if (parts.length > 0) {
              capturedName = parts.join(' ').trim();
            }
          }
        } catch {
          // If JSON parse fails, ignore name capture
        }
      }

      const email = String(payload.email).toLowerCase().trim();
      const isPrivate = email.endsWith('@privaterelay.appleid.com');
      const emailVerified =
        payload.email_verified === true || payload.email_verified === 'true';

      return {
        sub: String(payload.sub),
        email,
        email_verified: emailVerified,
        name: capturedName,
        is_private_email: isPrivate,
      };
    } catch (err) {
      this.logger.error(
        `Failed to verify Apple ID token: ${(err as Error).message}`,
      );
      throw new BadRequestException(
        (err as Error).message || 'Failed to authenticate with Apple',
      );
    }
  }
}
