import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Headline must be at most 120 characters' })
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Bio must be at most 500 characters' })
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Location must be at most 80 characters' })
  location?: string;
}
