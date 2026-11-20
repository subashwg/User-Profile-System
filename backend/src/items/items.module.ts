import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';
import { RoleItemsController } from './role-items.controller.js';
import { CoverService } from './services/cover.service.js';
import { PreviewService } from './services/preview.service.js';

@Module({
  imports: [PrismaModule, CommonModule, StorageModule],
  controllers: [ItemsController, RoleItemsController],
  providers: [ItemsService, PreviewService, CoverService],
  exports: [ItemsService, PreviewService, CoverService],
})
export class ItemsModule {}
