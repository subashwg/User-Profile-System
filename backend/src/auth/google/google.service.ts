import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);
  private readonly oauthClient: OAuth2Client;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    this.callbackUrl =
      this.configService.get<string>('GOOGLE_CALLBACK_URL') || `${appUrl}/auth/google/callback`;

    this.oauthClient = new OAuth2Client(
      this.clientId,
      this.clientSecret,
      this.callbackUrl,
    );
  }

  generateAuthUrl(state: string): string {
    return this.oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'openid',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
      prompt: 'select_account',
    });
  }

  async verifyCodeAndGetUserInfo(code: string): Promise<GoogleUserInfo> {
    try {
      const { tokens } = await this.oauthClient.getToken(code);

      if (!tokens.id_token) {
        throw new BadRequestException('Google did not return an ID token');
      }

      const ticket = await this.oauthClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.clientId,
      });

      const payload = ticket.getPayload();

      if (!payload || !payload.sub || !payload.email) {
        throw new BadRequestException('Google token payload missing required user information');
      }

      return {
        sub: payload.sub,
        email: payload.email.toLowerCase().trim(),
        email_verified: Boolean(payload.email_verified),
        name: payload.name,
        picture: payload.picture,
      };
    } catch (err) {
      this.logger.error(`Failed to verify Google authorization code: ${(err as Error).message}`);
      throw new BadRequestException(
        (err as Error).message || 'Failed to authenticate with Google',
      );
    }
  }
}
