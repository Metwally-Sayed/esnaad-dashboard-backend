import { User, Role } from '@prisma/client';
import { prisma } from '../../../config/database';

export class AuthRepository {
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async createUser(data: {
    email: string;
    password: string;
    name?: string;
    role?: Role;
  }): Promise<User> {
    const role = data.role || Role.OWNER;

    return prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: role,
        emailVerified: false,
        isActive: true,
        // Set verification status based on role
        verificationStatus: role === Role.ADMIN ? 'NOT_REQUIRED' : 'PENDING_DOCUMENTS',
      },
    });
  }

  async verifyUserEmail(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  async findExternalClient(email: string): Promise<boolean> {
    const client = await prisma.externalClient.findUnique({
      where: { email, verified: true },
    });
    return !!client;
  }

  async findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }
}
