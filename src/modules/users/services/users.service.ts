import { Role, Prisma, AuditAction } from '@prisma/client';
import { UsersRepository, UserWithoutPassword } from '../repositories/users.repository';
import { NotFoundError, ForbiddenError } from '../../../common/errors';
import {
  getPaginationParams,
  getPrismaSkipTake,
  createPaginatedResponse,
  PaginatedResponse,
} from '../../../common/utils/pagination';
import { GetUsersQueryDto, UpdateUserDto } from '../dto/users.dto';
import { prisma } from '../../../config/database';

export class UsersService {
  private usersRepo: UsersRepository;

  constructor() {
    this.usersRepo = new UsersRepository();
  }

  async getUsers(
    query: GetUsersQueryDto,
    _requestingUser: { id: string; role: Role }
  ): Promise<PaginatedResponse<UserWithoutPassword>> {
    const { page, limit, sortBy, sortOrder } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    // Build where clause
    const where: Prisma.UserWhereInput = {};

    // Role filter
    if (query.role) {
      where.role = query.role;
    }

    // Active status filter
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    // Search by email or name
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Order by
    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy as keyof Prisma.UserOrderByWithRelationInput]: sortOrder,
    };

    // Fetch users and count
    const [users, total] = await Promise.all([
      this.usersRepo.findAll({ skip, take, where, orderBy }),
      this.usersRepo.count(where),
    ]);

    return createPaginatedResponse(users, page, limit, total);
  }

  async getUserById(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<UserWithoutPassword> {
    // Owners can only view themselves, admins can view anyone
    if (requestingUser.role === Role.OWNER && requestingUser.id !== id) {
      throw new ForbiddenError('You can only view your own profile');
    }

    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async updateUser(
    id: string,
    data: UpdateUserDto,
    requestingUser: { id: string; role: Role }
  ): Promise<UserWithoutPassword> {
    const existingUser = await this.usersRepo.findById(id);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Store old values for audit
    const oldValues = {
      name: existingUser.name,
      phone: existingUser.phone,
      address: existingUser.address,
      nationalId: existingUser.nationalId,
      role: existingUser.role,
      isActive: existingUser.isActive,
    };

    const updatedUser = await this.usersRepo.update(id, data);

    // Create audit log
    await this.createAuditLog({
      action: AuditAction.USER_UPDATED,
      entityType: 'user',
      entityId: id,
      actorId: requestingUser.id,
      changes: {
        old: oldValues,
        new: data,
      },
    });

    return updatedUser;
  }

  async deleteUser(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<void> {
    // Cannot delete yourself
    if (requestingUser.id === id) {
      throw new ForbiddenError('You cannot delete your own account');
    }

    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await this.usersRepo.delete(id);

    // Create audit log
    await this.createAuditLog({
      action: AuditAction.USER_DELETED,
      entityType: 'user',
      entityId: id,
      actorId: requestingUser.id,
      changes: { deleted: user },
    });
  }

  private async createAuditLog(data: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    actorId: string;
    changes?: any;
    metadata?: any;
  }) {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        actorId: data.actorId,
        changes: data.changes,
        metadata: data.metadata,
      },
    });
  }
}
