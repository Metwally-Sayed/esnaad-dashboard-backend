import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ServiceChargeRepository } from '../repositories/service-charge.repository';
import { NotFoundError } from '../../../common/errors';
import { AuditAction } from '@prisma/client';
import { prisma } from '../../../config/database';
import { CloudinaryUploadService } from '../../uploads/services/cloudinary-upload.service';

export class ServiceChargePdfService {
  private repo: ServiceChargeRepository;
  private cloudinaryService: CloudinaryUploadService;

  constructor() {
    this.repo = new ServiceChargeRepository();
    this.cloudinaryService = new CloudinaryUploadService();
  }

  /**
   * Generate PDF statement for a unit service charge
   */
  async generatePdfStatement(
    unitServiceChargeId: string,
    requestingUserId: string
  ): Promise<{ url: string }> {
    // Get unit service charge with full details
    const unitChargeRaw = await this.repo.findUnitServiceChargeById(unitServiceChargeId);
    if (!unitChargeRaw) {
      throw new NotFoundError('Unit service charge not found');
    }

    // Type assertion for included relations
    const unitCharge = unitChargeRaw as any;

    // Prepare template data
    const finalAmount = unitCharge.isOverridden
      ? unitCharge.overriddenAmount
      : unitCharge.amount;

    const periodLabel =
      unitCharge.projectServiceCharge.periodType === 'YEARLY'
        ? `Year ${unitCharge.projectServiceCharge.year}`
        : `Q${unitCharge.projectServiceCharge.quarter} ${unitCharge.projectServiceCharge.year}`;

    const templateData = {
      // Company/Header info
      companyName: 'Esnaad Property Management',
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),

      // Period info
      periodLabel,
      year: unitCharge.projectServiceCharge.year,
      quarter: unitCharge.projectServiceCharge.quarter || 'N/A',
      periodType: unitCharge.projectServiceCharge.periodType,

      // Project & Unit info
      projectName: unitCharge.projectServiceCharge.project.name,
      projectLocation: unitCharge.projectServiceCharge.project.location || 'N/A',
      unitNumber: unitCharge.unit.unitNumber,
      buildingName: unitCharge.unit.buildingName || 'N/A',

      // Owner info
      ownerName: unitCharge.unit.owner?.name || unitCharge.unit.owner?.email || 'N/A',
      ownerEmail: unitCharge.unit.owner?.email || 'N/A',

      // Financial details
      unitPrice: unitCharge.unit.price?.toString() || '0',
      percentage: unitCharge.projectServiceCharge.percentage?.toString() || null,
      hasPercentage: unitCharge.projectServiceCharge.percentage !== null,
      calculatedAmount: unitCharge.amount.toString(),
      isOverridden: unitCharge.isOverridden,
      overriddenAmount: unitCharge.overriddenAmount?.toString(),
      finalAmount: finalAmount?.toString() || '0',
      paidAmount: unitCharge.paidAmount?.toString() || '0',
      balance: (parseFloat(finalAmount?.toString() || '0') - parseFloat(unitCharge.paidAmount?.toString() || '0')).toFixed(2),

      // Due date
      dueDate: unitCharge.projectServiceCharge.dueDate
        ? new Date(unitCharge.projectServiceCharge.dueDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'N/A',

      // Status
      isPaid: unitCharge.isPaid,
      paidAt: unitCharge.paidAt
        ? new Date(unitCharge.paidAt).toLocaleDateString('en-US')
        : null,
    };

    // Read template file
    const templatePath = path.join(
      __dirname,
      '../templates/service-charge-statement.hbs'
    );
    const templateSource = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);
    const html = template(templateData);

    // Generate PDF with Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    await browser.close();

    // Upload to Cloudinary
    const filename = `service-charge-${unitCharge.unit.unitNumber}-${periodLabel.replace(/\s+/g, '-')}.pdf`;
    const uploadResult = await this.cloudinaryService.uploadFileDirectly({
      fileBuffer: Buffer.from(pdfBuffer),
      fileName: filename,
      mimeType: 'application/pdf',
      userId: 'system',
    });

    // Update unit service charge with PDF URL
    await prisma.unitServiceCharge.update({
      where: { id: unitServiceChargeId },
      data: {
        pdfUrl: uploadResult.publicUrl,
        pdfGeneratedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.SERVICE_CHARGE_STATEMENT_GENERATED,
        entityType: 'unit_service_charge',
        entityId: unitServiceChargeId,
        actorId: requestingUserId,
        unitId: unitCharge.unitId,
        changes: { pdfUrl: uploadResult.publicUrl },
      },
    });

    return { url: uploadResult.publicUrl };
  }
}
