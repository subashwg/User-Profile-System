import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSkillDto {
  @IsString()
  @IsNotEmpty({ message: 'Skill name cannot be empty' })
  @MaxLength(40, { message: 'Skill name must not exceed 40 characters' })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    // Strip HTML/script tags and trim whitespace
    return value.replace(/<[^>]*>?/gm, '').trim();
  })
  name!: string;
}
