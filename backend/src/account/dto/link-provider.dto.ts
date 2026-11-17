import { IsNotEmpty, IsString } from 'class-validator';

export class LinkProviderDto {
  @IsString()
  @IsNotEmpty({ message: 'Token or authorization code is required' })
  credential!: string;
}
