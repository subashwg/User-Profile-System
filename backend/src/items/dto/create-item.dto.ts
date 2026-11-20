import { CoverSource, PortfolioItemKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { sanitizePlainText } from '../utils/url.util.js';

export class CreateItemDto {
  @IsUUID('4', { message: 'role_id must be a valid UUID' })
  @IsNotEmpty({ message: 'role_id is required' })
  role_id!: string;

  @IsEnum(PortfolioItemKind, {
    message: 'kind must be one of: video, article, course, project, product, other',
  })
  @IsNotEmpty({ message: 'kind is required' })
  kind!: PortfolioItemKind;

  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  @MaxLength(100, { message: 'Title must not exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Description must not exceed 300 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  description?: string;

  @IsString()
  @IsNotEmpty({ message: 'url is required' })
  @MaxLength(2000, { message: 'URL must not exceed 2000 characters' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'URL must be a valid http or https link' },
  )
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Cover URL must not exceed 2000 characters' })
  cover_url?: string;

  @IsOptional()
  @IsEnum(CoverSource, {
    message: 'cover_source must be one of: none, link, upload',
  })
  cover_source?: CoverSource;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Source site must not exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  source_site?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'published_on must be a valid ISO-8601 date string' })
  published_on?: string;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsBoolean()
  is_hidden?: boolean;
}
