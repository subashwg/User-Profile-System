import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { ROLE_PRESETS } from './roles.presets.js';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  getPresets(): string[] {
    return [...ROLE_PRESETS];
  }

  async getRoles(userId: string) {
    return this.prisma.role.findMany({
      where: { user_id: userId },
      orderBy: { position: 'asc' },
      include: {
        skills: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  async createRole(userId: string, dto: CreateRoleDto) {
    const cleanTitle = dto.title.trim();

    // Limit check: maximum 5 roles per user
    const currentCount = await this.prisma.role.count({
      where: { user_id: userId },
    });

    if (currentCount >= 5) {
      throw new BadRequestException('A user can have at most 5 roles.');
    }

    // Case-insensitive title uniqueness per user
    const existingRole = await this.prisma.role.findFirst({
      where: {
        user_id: userId,
        title: { equals: cleanTitle, mode: 'insensitive' },
      },
    });

    if (existingRole) {
      throw new BadRequestException(`A role with title "${cleanTitle}" already exists.`);
    }

    // Determine primary status: first role is always primary; otherwise respect dto
    const isPrimary = currentCount === 0 ? true : !!dto.is_primary;

    return this.prisma.$transaction(async (tx) => {
      // If marking as primary, demote existing primary roles
      if (isPrimary && currentCount > 0) {
        await tx.role.updateMany({
          where: { user_id: userId, is_primary: true },
          data: { is_primary: false },
        });
      }

      return tx.role.create({
        data: {
          user_id: userId,
          title: cleanTitle,
          description: dto.description ? dto.description.trim() : null,
          position: currentCount,
          is_primary: isPrimary,
        },
        include: {
          skills: {
            orderBy: { position: 'asc' },
          },
        },
      });
    });
  }

  async updateRole(userId: string, roleId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, user_id: userId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    let cleanTitle: string | undefined = undefined;
    if (dto.title !== undefined) {
      cleanTitle = dto.title.trim();
      if (cleanTitle.toLowerCase() !== role.title.toLowerCase()) {
        const existingRole = await this.prisma.role.findFirst({
          where: {
            user_id: userId,
            id: { not: roleId },
            title: { equals: cleanTitle, mode: 'insensitive' },
          },
        });

        if (existingRole) {
          throw new BadRequestException(`A role with title "${cleanTitle}" already exists.`);
        }
      }
    }

    if (dto.is_primary === false && role.is_primary) {
      throw new BadRequestException(
        'One role must remain primary. To change primary role, set another role as primary.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.is_primary === true && !role.is_primary) {
        await tx.role.updateMany({
          where: { user_id: userId, is_primary: true },
          data: { is_primary: false },
        });
      }

      return tx.role.update({
        where: { id: roleId },
        data: {
          ...(cleanTitle !== undefined ? { title: cleanTitle } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description ? dto.description.trim() : null }
            : {}),
          ...(dto.is_primary !== undefined ? { is_primary: dto.is_primary } : {}),
        },
        include: {
          skills: {
            orderBy: { position: 'asc' },
          },
        },
      });
    });
  }

  async deleteRole(userId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, user_id: userId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Deleting role automatically cascade-deletes skills via foreign key
      await tx.role.delete({ where: { id: roleId } });

      const remainingRoles = await tx.role.findMany({
        where: { user_id: userId },
        orderBy: { position: 'asc' },
      });

      const hasPrimary = remainingRoles.some((r) => r.is_primary);

      for (let i = 0; i < remainingRoles.length; i++) {
        const shouldBePrimary = !hasPrimary && i === 0;
        await tx.role.update({
          where: { id: remainingRoles[i].id },
          data: {
            position: i,
            ...(shouldBePrimary ? { is_primary: true } : {}),
          },
        });
      }
    });

    return { success: true, message: 'Role deleted successfully' };
  }

  async reorderRoles(userId: string, roleIds: string[]) {
    const uniqueProvidedIds = new Set(roleIds);
    if (uniqueProvidedIds.size !== roleIds.length) {
      throw new BadRequestException('Duplicate role IDs provided in reorder list.');
    }

    const currentRoles = await this.prisma.role.findMany({
      where: { user_id: userId },
    });

    if (currentRoles.length !== roleIds.length) {
      throw new BadRequestException(
        'Role IDs list must contain every user role ID exactly once.',
      );
    }

    const currentRoleIdsSet = new Set(currentRoles.map((r) => r.id));

    for (const id of roleIds) {
      if (!currentRoleIdsSet.has(id)) {
        throw new BadRequestException(
          'Role IDs list must contain every user role ID exactly once.',
        );
      }
    }

    await this.prisma.$transaction(
      roleIds.map((id, index) =>
        this.prisma.role.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    return this.prisma.role.findMany({
      where: { user_id: userId },
      orderBy: { position: 'asc' },
      include: {
        skills: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }
}
