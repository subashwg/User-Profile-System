import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { PreviewItemDto } from './dto/preview-item.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';
import { ItemsService } from './items.service.js';
import { PreviewService } from './services/preview.service.js';

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

@Controller('items')
@UseGuards(SessionAuthGuard)
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly previewService: PreviewService,
  ) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async previewLink(
    @Req() req: RequestWithAuth,
    @Body() dto: PreviewItemDto,
  ) {
    return this.previewService.getPreview(req.user.id, dto.url);
  }

  @Get()
  async getItems(
    @Req() req: RequestWithAuth,
    @Query('flat') flat?: string,
  ) {
    const isFlat = flat === 'true' || flat === '1';
    return this.itemsService.getItems(req.user.id, isFlat);
  }

  @Post()
  async createItem(
    @Req() req: RequestWithAuth,
    @Body() createItemDto: CreateItemDto,
  ) {
    return this.itemsService.createItem(req.user.id, createItemDto);
  }

  @Get(':id')
  async getItem(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
  ) {
    return this.itemsService.getItem(req.user.id, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateItem(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
  ) {
    return this.itemsService.updateItem(req.user.id, id, updateItemDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteItem(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
  ) {
    return this.itemsService.deleteItem(req.user.id, id);
  }
}
