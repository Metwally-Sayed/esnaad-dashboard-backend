import { Project, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';

export class ProjectsRepository {
  async findAll(params: {
    skip: number;
    take: number;
    where?: Prisma.ProjectWhereInput;
    orderBy?: Prisma.ProjectOrderByWithRelationInput;
  }): Promise<Project[]> {
    return prisma.project.findMany({
      skip: params.skip,
      take: params.take,
      where: params.where,
      orderBy: params.orderBy,
      include: {
        units: {
          select: {
            id: true,
            unitNumber: true,
            unitType: true,
          },
        },
      },
    });
  }

  async count(where?: Prisma.ProjectWhereInput): Promise<number> {
    return prisma.project.count({ where });
  }

  async findById(id: string): Promise<Project | null> {
    return prisma.project.findUnique({
      where: { id },
      include: {
        units: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            unitType: true,
            ownerId: true,
          },
        },
      },
    });
  }

  async create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return prisma.project.create({
      data,
      include: {
        units: true,
      },
    });
  }

  async update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return prisma.project.update({
      where: { id },
      data,
      include: {
        units: true,
      },
    });
  }

  async delete(id: string): Promise<Project> {
    return prisma.project.delete({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Project | null> {
    return prisma.project.findFirst({
      where: { name },
    });
  }
}
