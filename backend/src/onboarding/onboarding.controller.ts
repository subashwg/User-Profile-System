import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto.js';
import { OnboardingService } from './onboarding.service.js';

interface RequestWithAuth extends Request {
  user: {
    id: string;
    email: string;
    email_verified: boolean;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    onboarding_completed: boolean;
  };
  session: {
    id: string;
  };
}

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async complete(
    @Body() completeOnboardingDto: CompleteOnboardingDto,
    @Req() req: RequestWithAuth,
  ) {
    return this.onboardingService.completeOnboarding(
      req.user.id,
      completeOnboardingDto,
    );
  }
}
