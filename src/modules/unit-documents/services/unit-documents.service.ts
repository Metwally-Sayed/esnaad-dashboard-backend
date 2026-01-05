import { UnitDocument, Role, Prisma, AuditAction } from '@prisma/client';
import { UnitDocumentsRepository } from '../repositories/unit-documents.repository';
import { NotFoundError, ForbiddenError } from '../../../common/errors';
import {
  getPaginationParams,
  getPrismaSkipTake,
  createPaginatedResponse,
  PaginatedResponse,
} from '../../../common/utils/pagination';
import { GetUnitDocumentsQueryDto, CreateDocumentDto, GetAllDocumentsQueryDto } from '../dto/unit-documents.dto';
import { prisma } from '../../../config/database';
import { R2UploadService } from '../../uploads/services/r2-upload.service';
import { getCloudinaryUrl } from '../../../common/utils/cloudinary';

type UnitDocumentWithUrl = UnitDocument & { publicUrl: string };

export class UnitDocumentsService {
  private documentsRepo: UnitDocumentsRepository;
  private r2Service: R2UploadService;

  constructor() {
    this.documentsRepo = new UnitDocumentsRepository();
    this.r2Service = new R2UploadService();
  }

  async getUnitDocuments(
    unitId: string,
    query: GetUnitDocumentsQueryDto,
    requestingUser: { id: string; role: Role }
  ): Promise<PaginatedResponse<UnitDocumentWithUrl>> {
    await this.checkUnitAccess(unitId, requestingUser);

    const { page, limit, sortBy, sortOrder } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    const where: Prisma.UnitDocumentWhereInput = {};

    if (query.category) {
      where.category = query.category;
    }

    const orderBy: Prisma.UnitDocumentOrderByWithRelationInput = {
      [sortBy as keyof Prisma.UnitDocumentOrderByWithRelationInput]: sortOrder,
    };

    const [documents, total] = await Promise.all([
      this.documentsRepo.findByUnitId({ unitId, skip, take, where, orderBy }),
      this.documentsRepo.countByUnitId(unitId, where),
    ]);

    const documentsWithUrls = this.addPublicUrls(documents);
    return createPaginatedResponse(documentsWithUrls, page, limit, total);
  }

  async getAllDocuments(
    query: GetAllDocumentsQueryDto,
    requestingUser: { id: string; role: Role }
  ): Promise<PaginatedResponse<UnitDocumentWithUrl>> {
    const { page, limit, sortBy, sortOrder } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    const where: Prisma.UnitDocumentWhereInput = {};

    // If OWNER, only show documents for units they own
    if (requestingUser.role === Role.OWNER) {
      where.unit = {
        ownerId: requestingUser.id
      };
    }

    if (query.unitId) {
      where.unitId = query.unitId;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { unit: { unitNumber: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const orderBy: Prisma.UnitDocumentOrderByWithRelationInput = {
      [sortBy as keyof Prisma.UnitDocumentOrderByWithRelationInput]: sortOrder,
    };

    const [documents, total] = await Promise.all([
      this.documentsRepo.findAll({ skip, take, where, orderBy }),
      this.documentsRepo.count(where),
    ]);

    const documentsWithUrls = this.addPublicUrls(documents);
    return createPaginatedResponse(documentsWithUrls, page, limit, total);
  }

  async createDocument(
    unitId: string,
    data: CreateDocumentDto,
    requestingUser: { id: string; role: Role }
  ): Promise<UnitDocumentWithUrl> {
    console.log('🔵 Document Service - Creating document');
    console.log('  Unit ID:', unitId);
    console.log('  Data received:');
    console.log(JSON.stringify(data, null, 2));

    await this.checkUnitUploadAccess(unitId, requestingUser);

    const documentData = {
      title: data.title,
      category: data.category,
      fileKey: data.fileKey,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      unit: { connect: { id: unitId } },
      uploadedBy: { connect: { id: requestingUser.id } },
    };

    console.log('🔵 Document Service - Saving to database with data:');
    console.log(JSON.stringify(documentData, null, 2));

    const document = await this.documentsRepo.create(documentData);

    console.log('🟢 Document Service - Document saved to database:');
    console.log('  Document ID:', document.id);
    console.log('  FileKey stored:', document.fileKey);

    await this.createAuditLog({
      action: AuditAction.UNIT_DOCUMENT_UPLOADED,
      entityType: 'unit_document',
      entityId: document.id,
      actorId: requestingUser.id,
      unitId,
      changes: { created: data },
    });

    const result = this.addPublicUrl(document);

    console.log('🟢 Document Service - Returning document with publicUrl:');
    console.log('  PublicUrl:', result.publicUrl);

    return result;
  }

  async getDocumentById(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<UnitDocumentWithUrl> {
    const document = await this.documentsRepo.findById(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    await this.checkUnitAccess(document.unitId, requestingUser);

    return this.addPublicUrl(document);
  }

  async getDownloadUrl(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<{ downloadUrl: string }> {
    const document = await this.getDocumentById(id, requestingUser);

    // Generate presigned download URL (valid for 1 hour)
    const downloadUrl = await this.r2Service.getPresignedUploadUrl({
      fileName: document.title,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      userId: requestingUser.id,
    });

    return { downloadUrl: downloadUrl.publicUrl };
  }

  async deleteDocument(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<void> {
    const document = await this.documentsRepo.findById(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Only admins can delete documents
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can delete documents');
    }

    await this.documentsRepo.delete(id);

    await this.createAuditLog({
      action: AuditAction.UNIT_DOCUMENT_DELETED,
      entityType: 'unit_document',
      entityId: id,
      actorId: requestingUser.id,
      unitId: document.unitId,
      changes: { deleted: document },
    });
  }

  private async checkUnitAccess(
    unitId: string,
    requestingUser: { id: string; role: Role }
  ): Promise<void> {
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    if (requestingUser.role === Role.OWNER && unit.ownerId !== requestingUser.id) {
      throw new ForbiddenError('You can only view documents for units you own');
    }
  }

  private async checkUnitUploadAccess(
    unitId: string,
    requestingUser: { id: string; role: Role }
  ): Promise<void> {
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    if (requestingUser.role === Role.OWNER && unit.ownerId !== requestingUser.id) {
      throw new ForbiddenError('You can only upload documents for units you own');
    }
  }

  private async createAuditLog(data: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    actorId: string;
    unitId?: string;
    changes?: any;
    metadata?: any;
  }) {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        actorId: data.actorId,
        unitId: data.unitId,
        changes: data.changes,
        metadata: data.metadata,
      },
    });
  }

  /**
   * Add publicUrl field to a single document
   * If the fileKey is actually a full URL (from Cloudinary), use it directly
   * Otherwise construct the URL from the fileKey
   */
  private addPublicUrl(document: UnitDocument): UnitDocumentWithUrl {
    // If fileKey already looks like a full URL (starts with https://), use it as-is
    if (document.fileKey.startsWith('https://')) {
      return {
        ...document,
        publicUrl: document.fileKey,
      };
    }

    // Otherwise construct the Cloudinary URL from the public_id
    return {
      ...document,
      publicUrl: getCloudinaryUrl(document.fileKey),
    };
  }

  /**
   * Add publicUrl field to multiple documents
   */
  private addPublicUrls(documents: UnitDocument[]): UnitDocumentWithUrl[] {
    return documents.map(doc => this.addPublicUrl(doc));
  }
}
