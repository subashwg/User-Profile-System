import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:5173';

  @IsString()
  @IsOptional()
  APP_URL: string = 'http://localhost:3000';

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  SESSION_SECRET: string = 'dev-secret-key-at-least-32-characters-long-portfolio-profile';

  @IsNumber()
  @IsOptional()
  SESSION_MAX_AGE_DAYS: number = 30;

  @IsString()
  @IsOptional()
  SMTP_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  SMTP_PORT: number = 1025;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM: string = 'Portfolio Profile <noreply@example.com>';

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  APPLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  APPLE_TEAM_ID?: string;

  @IsString()
  @IsOptional()
  APPLE_KEY_ID?: string;

  @IsString()
  @IsOptional()
  APPLE_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  APPLE_CALLBACK_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation error: ${errors.toString()}`);
  }

  return validatedConfig;
}
