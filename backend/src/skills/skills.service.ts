import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSkillDto } from './dto/create-skill.dto.js';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureRoleOwnedByUser(userId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, user_id: userId },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async getSkills(userId: string, roleId: string) {
    await this.ensureRoleOwnedByUser(userId, roleId);

    return this.prisma.skill.findMany({
      where: { role_id: roleId },
      orderBy: { position: 'asc' },
    });
  }

  async createSkill(userId: string, roleId: string, dto: CreateSkillDto) {
    await this.ensureRoleOwnedByUser(userId, roleId);

    const cleanName = dto.name.replace(/<[^>]*>?/gm, '').trim();
    if (!cleanName) {
      throw new BadRequestException('Skill name cannot be empty');
    }

    // Limit check: up to 15 skills per role
    const currentCount = await this.prisma.skill.count({
      where: { role_id: roleId },
    });

    if (currentCount >= 15) {
      throw new BadRequestException('A role can have at most 15 skills.');
    }

    // Case-insensitive duplicate check within this role
    const existingSkill = await this.prisma.skill.findFirst({
      where: {
        role_id: roleId,
        name: { equals: cleanName, mode: 'insensitive' },
      },
    });

    if (existingSkill) {
      throw new BadRequestException(`Skill "${cleanName}" already exists for this role.`);
    }

    return this.prisma.skill.create({
      data: {
        role_id: roleId,
        name: cleanName,
        position: currentCount,
      },
    });
  }

  async deleteSkill(userId: string, roleId: string, skillId: string) {
    await this.ensureRoleOwnedByUser(userId, roleId);

    const skill = await this.prisma.skill.findFirst({
      where: { id: skillId, role_id: roleId },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.skill.delete({ where: { id: skillId } });

      const remaining = await tx.skill.findMany({
        where: { role_id: roleId },
        orderBy: { position: 'asc' },
      });

      for (let i = 0; i < remaining.length; i++) {
        await tx.skill.update({
          where: { id: remaining[i].id },
          data: { position: i },
        });
      }
    });

    return { success: true, message: 'Skill deleted successfully' };
  }

  async reorderSkills(userId: string, roleId: string, skillIds: string[]) {
    await this.ensureRoleOwnedByUser(userId, roleId);

    const uniqueProvidedIds = new Set(skillIds);
    if (uniqueProvidedIds.size !== skillIds.length) {
      throw new BadRequestException('Duplicate skill IDs provided in reorder list.');
    }

    const currentSkills = await this.prisma.skill.findMany({
      where: { role_id: roleId },
    });

    if (currentSkills.length !== skillIds.length) {
      throw new BadRequestException(
        'Skill IDs list must contain every skill ID for this role exactly once.',
      );
    }

    const currentSkillIdsSet = new Set(currentSkills.map((s) => s.id));

    for (const id of skillIds) {
      if (!currentSkillIdsSet.has(id)) {
        throw new BadRequestException(
          'Skill IDs list must contain every skill ID for this role exactly once.',
        );
      }
    }

    await this.prisma.$transaction(
      skillIds.map((id, index) =>
        this.prisma.skill.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    return this.prisma.skill.findMany({
      where: { role_id: roleId },
      orderBy: { position: 'asc' },
    });
  }
}
