import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderSkillsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true, message: 'Each skill ID must be a valid UUID' })
  skill_ids!: string[];
}
