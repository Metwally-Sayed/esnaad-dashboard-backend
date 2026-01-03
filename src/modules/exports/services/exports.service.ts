import { Role } from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError, ForbiddenError } from '../../../common/errors';
import { logger } from '../../../config/logger';

export class ExportsService {
  async exportUnitToPdf(
    unitId: string,
    requestingUser: { id: string; role: Role }
  ): Promise<Buffer> {
    const unit = await this.getUnitWithPermissionCheck(unitId, requestingUser);

    // TODO: Implement actual PDF generation using a library like pdfkit or puppeteer
    // This is a placeholder implementation
    logger.info({ unitId, userId: requestingUser.id }, 'Exporting unit to PDF');

    const pdfContent = `
      Unit Profile
      ============

      Unit Number: ${unit.unitNumber}
      Building: ${unit.buildingName || 'N/A'}
      Floor: ${unit.floor || 'N/A'}
      Area: ${unit.area || 'N/A'} sqm
      Bedrooms: ${unit.bedrooms || 'N/A'}
      Bathrooms: ${unit.bathrooms || 'N/A'}

      Owner: ${unit.owner?.name || 'Unassigned'} (${unit.owner?.email || ''})

      Description:
      ${unit.description || 'No description'}
    `;

    return Buffer.from(pdfContent, 'utf-8');
  }

  async exportUnitToDocx(
    unitId: string,
    requestingUser: { id: string; role: Role }
  ): Promise<Buffer> {
    const unit = await this.getUnitWithPermissionCheck(unitId, requestingUser);

    // TODO: Implement actual DOCX generation using a library like docx
    // This is a placeholder implementation
    logger.info({ unitId, userId: requestingUser.id }, 'Exporting unit to DOCX');

    const docxContent = `Unit ${unit.unitNumber} - ${unit.buildingName || 'N/A'}`;

    return Buffer.from(docxContent, 'utf-8');
  }

  private async getUnitWithPermissionCheck(
    unitId: string,
    requestingUser: { id: string; role: Role }
  ) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    // Owners can only export their own units
    if (requestingUser.role === Role.OWNER && unit.ownerId !== requestingUser.id) {
      throw new ForbiddenError('You can only export your own units');
    }

    return unit;
  }
}
