import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export interface SentEmailRecord {
  to: string;
  subject: string;
  link: string;
  token: string;
  type: 'verify_email' | 'reset_password';
  sentAt: Date;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  // In-memory store for local development inspection and automated tests
  public latestEmails: SentEmailRecord[] = [];

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('EMAIL_FROM', 'Portfolio Profile <noreply@example.com>');
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');

    const host = this.configService.get<string>('SMTP_HOST', 'localhost');
    const port = this.configService.get<number>('SMTP_PORT', 1025);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendVerificationEmail(to: string, rawToken: string): Promise<string> {
    const verificationLink = `${this.frontendUrl}/?verify_token=${rawToken}`;
    const subject = 'Verify your email address';

    const record: SentEmailRecord = {
      to,
      subject,
      link: verificationLink,
      token: rawToken,
      type: 'verify_email',
      sentAt: new Date(),
    };

    this.latestEmails.unshift(record);
    if (this.latestEmails.length > 20) {
      this.latestEmails.pop();
    }

    this.logger.log(`\n==================================================\n` +
      `[EMAIL VERIFICATION]\nTo: ${to}\nLink: ${verificationLink}\n` +
      `==================================================\n`);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Verify your email address</h2>
            <p>Welcome to Portfolio Profile! Please click the link below to verify your email address. This link is valid for 24 hours.</p>
            <p style="margin: 24px 0;">
              <a href="${verificationLink}" style="background-color: #aa3bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Verify Email Address
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link in your browser:<br/><a href="${verificationLink}">${verificationLink}</a></p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.warn(`SMTP delivery skipped/failed (dev fallback active): ${(error as Error).message}`);
    }

    return verificationLink;
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<string> {
    const resetLink = `${this.frontendUrl}/?reset_token=${rawToken}`;
    const subject = 'Reset your password';

    const record: SentEmailRecord = {
      to,
      subject,
      link: resetLink,
      token: rawToken,
      type: 'reset_password',
      sentAt: new Date(),
    };

    this.latestEmails.unshift(record);
    if (this.latestEmails.length > 20) {
      this.latestEmails.pop();
    }

    this.logger.log(`\n==================================================\n` +
      `[PASSWORD RESET]\nTo: ${to}\nLink: ${resetLink}\n` +
      `==================================================\n`);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Reset your password</h2>
            <p>You requested to reset your password. Click the link below to choose a new password. This link is valid for 30 minutes.</p>
            <p style="margin: 24px 0;">
              <a href="${resetLink}" style="background-color: #aa3bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.warn(`SMTP delivery skipped/failed (dev fallback active): ${(error as Error).message}`);
    }

    return resetLink;
  }

  getLatestEmail(to?: string): SentEmailRecord | undefined {
    if (!to) return this.latestEmails[0];
    return this.latestEmails.find((e) => e.to.toLowerCase() === to.toLowerCase());
  }

  clearLatestEmails() {
    this.latestEmails = [];
  }
}
