import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CompleteOnboardingDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @Length(1, 100, { message: 'Name must be between 1 and 100 characters' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @Length(3, 30, { message: 'Username must be between 3 and 30 characters' })
  @Matches(/^[a-z0-9_]{3,30}$/, {
    message: 'Username can only contain lowercase letters, numbers, and underscores',
  })
  username!: string;
}
