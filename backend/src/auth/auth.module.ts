import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleService } from './google/google.service.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, GoogleService, SessionAuthGuard],
  exports: [AuthService, GoogleService, SessionAuthGuard],
})
export class AuthModule {}
