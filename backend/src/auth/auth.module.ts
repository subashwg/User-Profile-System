import { Module } from '@nestjs/common';
import { AppleService } from './apple/apple.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleService } from './google/google.service.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, GoogleService, AppleService, SessionAuthGuard],
  exports: [AuthService, GoogleService, AppleService, SessionAuthGuard],
})
export class AuthModule {}
