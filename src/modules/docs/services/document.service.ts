import { User, DocumentModule, DocumentType } from '@prisma/client';

// Minimal user type for document generation
type DocUser = Pick<User, 'id' | 'name' | 'email'> | { id: string; name?: string | null; email: string };
import { PrismaClient } from '@prisma/client';
import { DocumentRepository } from '../repositories/document.repository';
import { UploadService } from '@/modules/uploads/services/upload.service';
import { CloudinaryUploadService } from '@/modules/uploads/services/cloudinary-upload.service';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import QRCode from 'qrcode';
import { NotFoundError } from '@/common/errors/AppError';

export class DocumentService {
  private documentRepo: DocumentRepository;
  private uploadService: UploadService;
  private cloudinaryService: CloudinaryUploadService;

  constructor(private prisma: PrismaClient) {
    this.documentRepo = new DocumentRepository(prisma);
    this.uploadService = new UploadService();
    this.cloudinaryService = new CloudinaryUploadService();
  }

  // Register Handlebars helpers
  private registerHelpers() {
    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    Handlebars.registerHelper('formatDateTime', (date: Date | string) => {
      if (!date) return '';
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('gte', (a: number, b: number) => a >= b);
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    Handlebars.registerHelper('lte', (a: number, b: number) => a <= b);
    Handlebars.registerHelper('and', (a: any, b: any) => a && b);
    Handlebars.registerHelper('or', (a: any, b: any) => a || b);
    Handlebars.registerHelper('not', (a: any) => !a);
    Handlebars.registerHelper('json', (obj: any) => JSON.stringify(obj, null, 2));

    // String helpers
    Handlebars.registerHelper('toLowerCase', (str: string) => str ? str.toLowerCase() : '');
    Handlebars.registerHelper('toUpperCase', (str: string) => str ? str.toUpperCase() : '');

    // Snagging template helpers - for grouping items by category
    Handlebars.registerHelper('isFirstInCategory', function(currentCategory: string, prevCategory: string) {
      return currentCategory !== prevCategory;
    });

    Handlebars.registerHelper('isLastInCategory', function(currentCategory: string, items: any[], prevCategory: string) {
      const currentIndex = items.findIndex((item: any) => item.category === currentCategory);
      const nextIndex = currentIndex + 1;
      return nextIndex >= items.length || items[nextIndex].category !== currentCategory;
    });

    Handlebars.registerHelper('shouldBreakCategory', function(currentCategory: string, prevCategory: string) {
      return currentCategory !== prevCategory;
    });
  }

  // Generate PDF from HTML (private helper)
  private async generatePDFFromHTML(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Set PDF options
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm'
        }
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // Generic PDF generation from template key and data (public method)
  async generatePDF(templateKey: string, data: any): Promise<Buffer> {
    this.registerHelpers();

    // Load template
    const templatePath = path.join(
      __dirname,
      `../templates/${templateKey}.hbs`
    );

    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    // Generate HTML
    const html = template(data);

    // Generate PDF
    return await this.generatePDFFromHTML(html);
  }

  // Calculate SHA256 hash
  private calculateHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  // Generate handover agreement PDF
  async generateHandoverAgreement(handoverId: string, snapshot: any, user: DocUser): Promise<any> {
    this.registerHelpers();

    // Load template
    const templatePath = path.join(
      __dirname,
      '../templates/handover-agreement-v1.hbs'
    );
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    // Prepare data for template
    const templateData = {
      ...snapshot,
      generatedAt: new Date(),
      generatedBy: {
        name: user.name || user.email,
        email: user.email
      }
    };

    // Generate HTML
    const html = template(templateData);

    // Generate PDF
    const pdfBuffer = await this.generatePDFFromHTML(html);

    // Calculate hash
    const sha256Hash = this.calculateHash(pdfBuffer);

    // Upload to Cloudinary
    const fileName = `agreement-${Date.now()}.pdf`;
    const uploadResult = await this.cloudinaryService.uploadFileDirectly({
      fileBuffer: pdfBuffer,
      fileName: fileName,
      mimeType: 'application/pdf',
      userId: user.id
    });

    // Create document record
    const document = await this.documentRepo.create({
      module: 'HANDOVER' as DocumentModule,
      entityId: handoverId,
      type: 'PDF' as DocumentType,
      templateKey: 'handover-agreement-v1',
      version: 1,
      url: uploadResult.publicUrl,
      key: uploadResult.key,
      sha256Hash,
      sizeBytes: pdfBuffer.length,
      title: 'Handover Agreement',
      description: 'Formal unit handover agreement',
      metadata: {
        handoverId,
        generatedAt: new Date()
      },
      createdByUserId: user.id
    });

    return document;
  }

  // Get document by ID
  async getById(id: string): Promise<any> {
    const document = await this.documentRepo.findById(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }
    return document;
  }

  // Get documents for entity
  async getByModuleAndEntity(module: DocumentModule, entityId: string): Promise<any> {
    return this.documentRepo.findByModuleAndEntity(module, entityId);
  }

  // List documents
  async list(filters: any): Promise<any> {
    return this.documentRepo.findMany(filters);
  }

  // Get documents for a specific unit (all handovers for that unit)
  async getByUnitId(unitId: string): Promise<any> {
    // Find all handovers for this unit
    const handovers = await this.prisma.handover.findMany({
      where: { unitId },
      select: { id: true }
    });

    if (handovers.length === 0) {
      return [];
    }

    const handoverIds = handovers.map(h => h.id);

    // Get all documents for these handovers
    return this.prisma.document.findMany({
      where: {
        module: 'HANDOVER',
        entityId: { in: handoverIds }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        handover: {
          select: {
            id: true,
            status: true,
            handoverAt: true,
            completedAt: true
          }
        }
      }
    });
  }

  // Generate snagging agreement PDF
  async generateSnaggingAgreement(snaggingId: string, user: DocUser): Promise<{ pdfUrl: string; pdfPublicId: string }> {
    this.registerHelpers();

    // Load snagging with all relations
    const snagging = await this.prisma.snagging.findUnique({
      where: { id: snaggingId },
      include: {
        unit: true,
        owner: true,
        createdByAdmin: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      }
    });

    if (!snagging) {
      throw new NotFoundError('Snagging not found');
    }

    // Load template
    const templatePath = path.join(
      __dirname,
      '../templates/snagging-agreement-v1.hbs'
    );
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    // Flatten images from all items
    const allImages = snagging.items.flatMap(item =>
      item.images.map(img => ({
        imageUrl: img.imageUrl,
        caption: img.caption
      }))
    );

    // Prepare data for template
    const templateData = {
      snagging: {
        id: snagging.id,
        title: snagging.title,
        description: snagging.description,
        createdAt: snagging.createdAt
      },
      unit: snagging.unit,
      owner: snagging.owner,
      admin: snagging.createdByAdmin,
      items: snagging.items,
      images: allImages,
      generatedAt: new Date(),
      generatedBy: {
        name: user.name || user.email,
        email: user.email
      }
    };

    // Generate HTML
    const html = template(templateData);

    // Generate PDF
    const pdfBuffer = await this.generatePDFFromHTML(html);

    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFileDirectly({
      fileBuffer: pdfBuffer,
      fileName: `snagging-${snaggingId}-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      userId: user.id
    });

    return {
      pdfUrl: uploadResult.publicUrl,
      pdfPublicId: uploadResult.key
    };
  }

  // Generate request invitation/permit PDF
  async generateRequestInvitation(request: any, user: DocUser): Promise<{ pdfUrl: string; pdfPublicId: string }> {
    this.registerHelpers();

    // Load template
    const templatePath = path.join(
      __dirname,
      '../templates/request-invitation-v1.hbs'
    );
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    // Prepare data for template
    const templateData = {
      request: {
        id: request.id,
        type: request.type,
        status: request.status,
        purpose: request.purpose,
        visitorName: request.visitorName,
        visitorPhone: request.visitorPhone,
        companyName: request.companyName,
        representativeName: request.representativeName,
        startAt: request.startAt,
        endAt: request.endAt,
        expiresMode: request.expiresMode,
        expiresAt: request.expiresAt,
        maxUses: request.maxUses,
        usesCount: request.usesCount,
        approvedAt: request.approvedAt,
        createdAt: request.createdAt
      },
      unit: request.unit,
      owner: request.owner,
      admin: request.approvedByAdmin,
      generatedAt: new Date(),
      generatedBy: {
        name: user.name || user.email,
        email: user.email
      }
    };

    // Generate HTML
    const html = template(templateData);

    // Generate PDF
    const pdfBuffer = await this.generatePDFFromHTML(html);

    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFileDirectly({
      fileBuffer: pdfBuffer,
      fileName: `request-${request.id}-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      userId: user.id
    });

    return {
      pdfUrl: uploadResult.publicUrl,
      pdfPublicId: uploadResult.key
    };
  }

  // Generate tenant registration certificate PDF with QR code
  async generateTenantRegistrationCertificate(request: any, user: DocUser): Promise<{ pdfUrl: string; pdfPublicId: string }> {
    this.registerHelpers();

    // Generate verification URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/requests/${request.id}`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#1d4ed8',
        light: '#ffffff'
      }
    });

    // Load template
    const templatePath = path.join(
      __dirname,
      '../templates/tenant-registration-v1.hbs'
    );
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    // Prepare data for template
    const templateData = {
      request: {
        id: request.id,
        approvedAt: request.approvedAt,
        createdAt: request.createdAt
      },
      unit: request.unit,
      owner: request.owner,
      tenant: {
        name: request.tenantName,
        email: request.tenantEmail,
        phone: request.tenantPhone
      },
      admin: request.approvedByAdmin,
      qrCodeDataUrl,
      verificationUrl,
      generatedAt: new Date(),
      generatedBy: {
        name: user.name || user.email,
        email: user.email
      }
    };

    // Generate HTML
    const html = template(templateData);

    // Generate PDF
    const pdfBuffer = await this.generatePDFFromHTML(html);

    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFileDirectly({
      fileBuffer: pdfBuffer,
      fileName: `tenant-certificate-${request.id}-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      userId: user.id
    });

    return {
      pdfUrl: uploadResult.publicUrl,
      pdfPublicId: uploadResult.key
    };
  }
}