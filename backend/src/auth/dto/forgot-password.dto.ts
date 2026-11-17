import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;
}
