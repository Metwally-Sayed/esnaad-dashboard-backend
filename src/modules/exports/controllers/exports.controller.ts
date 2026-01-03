import { Request, Response, NextFunction } from 'express';
import { ExportsService } from '../services/exports.service';

export class ExportsController {
  private exportsService: ExportsService;

  constructor() {
    this.exportsService = new ExportsService();
  }

  exportUnitToPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const buffer = await this.exportsService.exportUnitToPdf(id, req.user!);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="unit-${id}.pdf"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  exportUnitToDocx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const buffer = await this.exportsService.exportUnitToDocx(id, req.user!);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename="unit-${id}.docx"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
