import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { CreateSkillDto } from './dto/create-skill.dto.js';
import { ReorderSkillsDto } from './dto/reorder-skills.dto.js';
import { SkillsService } from './skills.service.js';

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

@Controller('roles/:roleId/skills')
@UseGuards(SessionAuthGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  async getSkills(
    @Req() req: RequestWithAuth,
    @Param('roleId') roleId: string,
  ) {
    return this.skillsService.getSkills(req.user.id, roleId);
  }

  @Post()
  async createSkill(
    @Req() req: RequestWithAuth,
    @Param('roleId') roleId: string,
    @Body() createSkillDto: CreateSkillDto,
  ) {
    return this.skillsService.createSkill(req.user.id, roleId, createSkillDto);
  }

  @Put('reorder')
  @HttpCode(HttpStatus.OK)
  async reorderSkills(
    @Req() req: RequestWithAuth,
    @Param('roleId') roleId: string,
    @Body() reorderDto: ReorderSkillsDto,
  ) {
    return this.skillsService.reorderSkills(
      req.user.id,
      roleId,
      reorderDto.skill_ids,
    );
  }

  @Delete(':skillId')
  @HttpCode(HttpStatus.OK)
  async deleteSkill(
    @Req() req: RequestWithAuth,
    @Param('roleId') roleId: string,
    @Param('skillId') skillId: string,
  ) {
    return this.skillsService.deleteSkill(req.user.id, roleId, skillId);
  }
}
