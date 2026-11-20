import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { ReorderRoleItemsDto } from './dto/reorder-items.dto.js';
import { ItemsService } from './items.service.js';

interface RequestWithAuth extends Request {
  user: {
    id: string;
    email: string;
    email_verified: boolean;
    name: string | null;
    username: string | null;
  };
  session: {
    id: string;
  };
}

@Controller('roles/:roleId/items')
@UseGuards(SessionAuthGuard)
export class RoleItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Put('order')
  @HttpCode(HttpStatus.OK)
  async reorderItems(
    @Req() req: RequestWithAuth,
    @Param('roleId') roleId: string,
    @Body() dto: ReorderRoleItemsDto,
  ) {
    return this.itemsService.reorderRoleItems(req.user.id, roleId, dto.item_ids);
  }
}
