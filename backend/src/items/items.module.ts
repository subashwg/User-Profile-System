import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';
import { RoleItemsController } from './role-items.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [ItemsController, RoleItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
