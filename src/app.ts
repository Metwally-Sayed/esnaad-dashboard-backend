import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './common/middleware/error.middleware';
import { globalRateLimiter } from './common/middleware/rateLimiter.middleware';

// Import routes
import authRoutes from './modules/auth/routes/auth.routes';
import usersRoutes from './modules/users/routes/users.routes';
import unitsRoutes from './modules/units/routes/units.routes';
import projectsRoutes from './modules/projects/routes/projects.routes';
import exportsRoutes from './modules/exports/routes/exports.routes';
import { createAuditRoutes } from './modules/audit-logs/routes/audit.routes';
import snaggingRoutes from './modules/snagging/routes/snagging.routes';
import uploadRoutes from './modules/uploads/routes/upload.routes';
import { createHandoverRoutes } from './modules/handover/routes/handover.routes';
import { createDocumentRoutes } from './modules/docs/routes/document.routes';
import unitDocumentsRoutes from './modules/unit-documents/routes/unit-documents.routes';
import unitNestedDocumentsRoutes from './modules/unit-documents/routes/unit-nested-documents.routes';
import { createRequestRoutes } from './modules/requests/routes/request.routes';
import { prisma } from './config/database';

export const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration - allow all origins with credentials
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        // For development, allow all origins
        // In production, you should check against a whitelist
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Set-Cookie'],
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  app.use(globalRateLimiter);

  // Request logging
  app.use((req, _res, next) => {
    logger.info({
      method: req.method,
      url: req.url,
      ip: req.ip,
    });
    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/units', unitsRoutes);
  app.use('/api/units/:unitId/documents', unitNestedDocumentsRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/exports', exportsRoutes);
  app.use('/api/audit-logs', createAuditRoutes(prisma));
  app.use('/api/snaggings', snaggingRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/handovers', createHandoverRoutes(prisma));
  app.use('/api/docs', createDocumentRoutes(prisma));
  app.use('/api/documents', unitDocumentsRoutes);
  app.use('/api/requests', createRequestRoutes());

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
};

// Export a default instance for Vercel
export const app = createApp();
