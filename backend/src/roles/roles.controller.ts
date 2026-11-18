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
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { ReorderRolesDto } from './dto/reorder-roles.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { RolesService } from './roles.service.js';

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

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('presets')
  getPresets() {
    return { presets: this.rolesService.getPresets() };
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  async getMyRoles(@Req() req: RequestWithAuth) {
    return this.rolesService.getRoles(req.user.id);
  }

  @Post()
  @UseGuards(SessionAuthGuard)
  async createRole(
    @Req() req: RequestWithAuth,
    @Body() createRoleDto: CreateRoleDto,
  ) {
    return this.rolesService.createRole(req.user.id, createRoleDto);
  }

  @Put('reorder')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async reorderRoles(
    @Req() req: RequestWithAuth,
    @Body() reorderDto: ReorderRolesDto,
  ) {
    return this.rolesService.reorderRoles(req.user.id, reorderDto.role_ids);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async updateRole(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.updateRole(req.user.id, id, updateRoleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async deleteRole(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return this.rolesService.deleteRole(req.user.id, id);
  }
}
