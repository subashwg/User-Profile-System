import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';
import { RoleItemsController } from './role-items.controller.js';
import { PreviewService } from './services/preview.service.js';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [ItemsController, RoleItemsController],
  providers: [ItemsService, PreviewService],
  exports: [ItemsService, PreviewService],
})
export class ItemsModule {}
