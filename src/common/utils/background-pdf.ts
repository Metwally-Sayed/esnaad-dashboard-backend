import { logger } from '@config/logger';

/**
 * Runs a PDF generation task in the background (fire-and-forget).
 * The caller returns immediately; the PDF generates asynchronously.
 * Errors are logged but never thrown to the caller.
 */
export function runBackgroundPdf(
  taskFn: () => Promise<void>,
  context: { entity: string; entityId: string }
) {
  taskFn().catch((err) => {
    logger.error(
      { err, entityId: context.entityId },
      `Background PDF generation failed for ${context.entity}`
    );
  });
}
