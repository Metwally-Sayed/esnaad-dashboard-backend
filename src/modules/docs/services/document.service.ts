import { User, DocumentModule, DocumentType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { DocumentRepository } from '../repositories/document.repository';
import { UploadService } from '@/modules/uploads/services/upload.service';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { NotFoundError } from '@/common/errors/AppError';

export class DocumentService {
  private documentRepo: DocumentRepository;
  private uploadService: UploadService;

  constructor(private prisma: PrismaClient) {
    this.documentRepo = new DocumentRepository(prisma);
    this.uploadService = new UploadService();
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
  }

  // Generate PDF from HTML
  private async generatePDF(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
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

  // Calculate SHA256 hash
  private calculateHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  // Generate handover agreement PDF
  async generateHandoverAgreement(handoverId: string, snapshot: any, user: User): Promise<any> {
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
    const pdfBuffer = await this.generatePDF(html);

    // Calculate hash
    const sha256Hash = this.calculateHash(pdfBuffer);

    // Upload to R2
    const fileName = `handovers/${handoverId}/agreement-${Date.now()}.pdf`;
    const uploadResult = await this.uploadService.uploadToR2(
      pdfBuffer,
      fileName,
      'application/pdf'
    );

    // Create document record
    const document = await this.documentRepo.create({
      module: 'HANDOVER' as DocumentModule,
      entityId: handoverId,
      type: 'PDF' as DocumentType,
      templateKey: 'handover-agreement-v1',
      version: 1,
      url: uploadResult.url,
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
}