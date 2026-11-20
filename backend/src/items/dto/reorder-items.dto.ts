import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderRoleItemsDto {
  @IsArray({ message: 'item_ids must be an array of UUIDs' })
  @ArrayNotEmpty({ message: 'item_ids cannot be empty' })
  @IsUUID('4', { each: true, message: 'Each item ID must be a valid UUID' })
  item_ids!: string[];
}
