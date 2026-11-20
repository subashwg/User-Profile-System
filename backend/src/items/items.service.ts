import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';
import { canonicalizeUrl, deriveSourceSite } from './utils/url.util.js';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a portfolio item under a role
   */
  async createItem(userId: string, dto: CreateItemDto) {
    // 1. Role ownership check
    const role = await this.prisma.role.findFirst({
      where: { id: dto.role_id, user_id: userId },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Maximum 50 items per user limit
      const currentCount = await tx.portfolioItem.count({
        where: { user_id: userId },
      });
      if (currentCount >= 50) {
        throw new BadRequestException('User cannot have more than 50 portfolio items.');
      }

      // 3. Maximum 5 featured items limit
      if (dto.is_featured) {
        const featuredCount = await tx.portfolioItem.count({
          where: { user_id: userId, is_featured: true },
        });
        if (featuredCount >= 5) {
          throw new BadRequestException('User cannot have more than 5 featured items.');
        }
      }

      // 4. Duplicate URL check (canonicalized)
      const canonicalTarget = canonicalizeUrl(dto.url);
      const existingItems = await tx.portfolioItem.findMany({
        where: { user_id: userId },
        select: { id: true, url: true },
      });

      const duplicate = existingItems.find(
        (item) => canonicalizeUrl(item.url) === canonicalTarget,
      );
      if (duplicate) {
        throw new BadRequestException(
          'An item with this link already exists in your portfolio.',
        );
      }

      // 5. Position: append to end of role's items
      const roleItemsCount = await tx.portfolioItem.count({
        where: { role_id: dto.role_id, user_id: userId },
      });

      // 6. Source site derivation
      const sourceSite =
        dto.source_site && dto.source_site.trim().length > 0
          ? dto.source_site.trim()
          : deriveSourceSite(dto.url);

      const publishedOn = dto.published_on ? new Date(dto.published_on) : null;

      return tx.portfolioItem.create({
        data: {
          user_id: userId,
          role_id: dto.role_id,
          kind: dto.kind,
          title: dto.title.trim(),
          description: dto.description ? dto.description.trim() : null,
          url: dto.url.trim(),
          cover_url: dto.cover_url ? dto.cover_url.trim() : null,
          cover_source: dto.cover_source ?? 'none',
          source_site: sourceSite,
          published_on: publishedOn,
          is_featured: !!dto.is_featured,
          is_hidden: !!dto.is_hidden,
          position: roleItemsCount,
        },
        include: {
          role: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    });
  }

  /**
   * List all items belonging to user, grouped by role (or flat)
   */
  async getItems(userId: string, flat = false) {
    if (flat) {
      return this.prisma.portfolioItem.findMany({
        where: { user_id: userId },
        orderBy: [{ role: { position: 'asc' } }, { position: 'asc' }],
        include: {
          role: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    }

    const roles = await this.prisma.role.findMany({
      where: { user_id: userId },
      orderBy: { position: 'asc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return roles.map((role) => ({
      role: {
        id: role.id,
        title: role.title,
        description: role.description,
        position: role.position,
        is_primary: role.is_primary,
      },
      items: role.items,
    }));
  }

  /**
   * Get single item by ID
   */
  async getItem(userId: string, itemId: string) {
    const item = await this.prisma.portfolioItem.findFirst({
      where: { id: itemId, user_id: userId },
      include: {
        role: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }

    return item;
  }

  /**
   * Update item fields, toggle featured/hidden, or move between roles
   */
  async updateItem(userId: string, itemId: string, dto: UpdateItemDto) {
    const item = await this.prisma.portfolioItem.findFirst({
      where: { id: itemId, user_id: userId },
    });
    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }

    // Role check if moving to another role
    if (dto.role_id && dto.role_id !== item.role_id) {
      const targetRole = await this.prisma.role.findFirst({
        where: { id: dto.role_id, user_id: userId },
      });
      if (!targetRole) {
        throw new NotFoundException('Target role not found');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Check featured limit if enabling is_featured
      if (dto.is_featured === true && !item.is_featured) {
        const featuredCount = await tx.portfolioItem.count({
          where: { user_id: userId, is_featured: true },
        });
        if (featuredCount >= 5) {
          throw new BadRequestException('User cannot have more than 5 featured items.');
        }
      }

      // Check duplicate URL if changing URL
      if (dto.url && dto.url.trim() !== item.url) {
        const canonicalTarget = canonicalizeUrl(dto.url);
        const existingItems = await tx.portfolioItem.findMany({
          where: { user_id: userId, id: { not: itemId } },
          select: { id: true, url: true },
        });

        const duplicate = existingItems.find(
          (other) => canonicalizeUrl(other.url) === canonicalTarget,
        );
        if (duplicate) {
          throw new BadRequestException(
            'An item with this link already exists in your portfolio.',
          );
        }
      }

      let newPosition = item.position;
      const isMovingRole = dto.role_id && dto.role_id !== item.role_id;

      if (isMovingRole) {
        // Count items in target role to append at the end
        newPosition = await tx.portfolioItem.count({
          where: { role_id: dto.role_id!, user_id: userId },
        });

        // Re-index old role items
        const remainingOld = await tx.portfolioItem.findMany({
          where: {
            role_id: item.role_id,
            user_id: userId,
            id: { not: itemId },
          },
          orderBy: { position: 'asc' },
        });

        for (let i = 0; i < remainingOld.length; i++) {
          await tx.portfolioItem.update({
            where: { id: remainingOld[i].id },
            data: { position: i },
          });
        }
      }

      // Build update payload
      const data: Prisma.PortfolioItemUpdateInput = {};

      if (isMovingRole) {
        data.role = { connect: { id: dto.role_id! } };
        data.position = newPosition;
      }

      if (dto.kind !== undefined) data.kind = dto.kind;
      if (dto.title !== undefined) data.title = dto.title.trim();
      if (dto.description !== undefined) {
        data.description = dto.description ? dto.description.trim() : null;
      }
      if (dto.url !== undefined) {
        data.url = dto.url.trim();
        // If url changed and source_site not explicitly provided, update source site
        if (dto.source_site === undefined) {
          data.source_site = deriveSourceSite(dto.url);
        }
      }
      if (dto.source_site !== undefined) {
        data.source_site = dto.source_site ? dto.source_site.trim() : null;
      }
      if (dto.cover_url !== undefined) {
        data.cover_url = dto.cover_url ? dto.cover_url.trim() : null;
      }
      if (dto.cover_source !== undefined) data.cover_source = dto.cover_source;
      if (dto.published_on !== undefined) {
        data.published_on = dto.published_on ? new Date(dto.published_on) : null;
      }
      if (dto.is_featured !== undefined) data.is_featured = dto.is_featured;
      if (dto.is_hidden !== undefined) data.is_hidden = dto.is_hidden;

      return tx.portfolioItem.update({
        where: { id: itemId },
        data,
        include: {
          role: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    });
  }

  /**
   * Delete item and re-index role items
   */
  async deleteItem(userId: string, itemId: string) {
    const item = await this.prisma.portfolioItem.findFirst({
      where: { id: itemId, user_id: userId },
    });
    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.portfolioItem.delete({
        where: { id: itemId },
      });

      // Re-index remaining items in role
      const remainingItems = await tx.portfolioItem.findMany({
        where: { role_id: item.role_id, user_id: userId },
        orderBy: { position: 'asc' },
      });

      for (let i = 0; i < remainingItems.length; i++) {
        await tx.portfolioItem.update({
          where: { id: remainingItems[i].id },
          data: { position: i },
        });
      }
    });

    return { success: true, message: 'Portfolio item deleted successfully' };
  }

  /**
   * Reorder items within a role
   * Enforces:
   * - Role must belong to user (otherwise 404)
   * - item_ids must contain all items of that role exactly once without duplicates
   */
  async reorderRoleItems(userId: string, roleId: string, itemIds: string[]) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, user_id: userId },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const uniqueProvidedIds = new Set(itemIds);
    if (uniqueProvidedIds.size !== itemIds.length) {
      throw new BadRequestException('Duplicate item IDs provided in reorder list.');
    }

    const currentItems = await this.prisma.portfolioItem.findMany({
      where: { role_id: roleId, user_id: userId },
      select: { id: true },
    });

    if (currentItems.length !== itemIds.length) {
      throw new BadRequestException(
        'Item IDs list must contain every item ID of this role exactly once.',
      );
    }

    const currentIdsSet = new Set(currentItems.map((item) => item.id));
    for (const id of itemIds) {
      if (!currentIdsSet.has(id)) {
        throw new BadRequestException(
          'Item IDs list must contain every item ID of this role exactly once.',
        );
      }
    }

    await this.prisma.$transaction(
      itemIds.map((id, index) =>
        this.prisma.portfolioItem.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    return this.prisma.portfolioItem.findMany({
      where: { role_id: roleId, user_id: userId },
      orderBy: { position: 'asc' },
      include: {
        role: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }
}
