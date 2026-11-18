import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true, message: 'Each role ID must be a valid UUID' })
  role_ids!: string[];
}
