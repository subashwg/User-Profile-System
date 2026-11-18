import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OnboardingRoleItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Role title is required' })
  @MaxLength(60, { message: 'Role title must not exceed 60 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Role description must not exceed 200 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}

export class OnboardingRolesDto {
  @IsArray()
  @ArrayMaxSize(5, { message: 'A user can select at most 5 roles during onboarding' })
  @ValidateNested({ each: true })
  @Type(() => OnboardingRoleItemDto)
  roles!: OnboardingRoleItemDto[];
}
