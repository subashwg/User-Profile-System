import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { PublicController } from './public.controller.js';

@Module({
  imports: [StorageModule],
  controllers: [ProfileController, PublicController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
