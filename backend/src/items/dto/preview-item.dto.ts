import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class PreviewItemDto {
  @IsString({ message: 'URL must be a string' })
  @IsNotEmpty({ message: 'URL is required' })
  @MaxLength(2000, { message: 'URL must not exceed 2000 characters' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'URL must be a valid http or https link' },
  )
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  url!: string;
}
