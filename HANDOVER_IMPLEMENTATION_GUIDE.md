# Handover Module Implementation Guide

## Overview
This guide provides instructions for integrating the Handover and Docs modules into your existing backend.

## Folder Structure

```
src/
├── modules/
│   ├── handover/                    # New Handover Module
│   │   ├── dto/
│   │   │   └── handover.dto.ts      # Zod validation schemas
│   │   ├── controllers/
│   │   │   └── handover.controller.ts # HTTP request handlers
│   │   ├── services/
│   │   │   └── handover.service.ts   # Business logic & state machine
│   │   ├── repositories/
│   │   │   └── handover.repository.ts # Database queries
│   │   └── routes/
│   │       └── handover.routes.ts    # Express routes
│   │
│   ├── docs/                         # New Docs Module (shared)
│   │   ├── dto/
│   │   │   └── document.dto.ts       # Document validation schemas
│   │   ├── controllers/
│   │   │   └── document.controller.ts # Document endpoints
│   │   ├── services/
│   │   │   └── document.service.ts   # PDF generation service
│   │   ├── repositories/
│   │   │   └── document.repository.ts # Document queries
│   │   ├── routes/
│   │   │   └── document.routes.ts    # Document routes
│   │   └── templates/
│   │       └── handover-agreement-v1.hbs # Handover PDF template
│   │
│   └── uploads/                      # Enhanced Upload Module
│       ├── dto/
│       │   └── upload.dto.ts         # Upload validation schemas
│       └── services/
│           └── upload.service.ts     # Cloudflare R2 service
│
└── prisma/
    └── handover-schema-additions.prisma # Database schema additions
```

## Installation Steps

### 1. Install Required Dependencies

```bash
npm install puppeteer handlebars @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Update Prisma Schema

Add the contents of `prisma/handover-schema-additions.prisma` to your main `schema.prisma`:

1. Add new enums:
   - HandoverStatus
   - HandoverItemStatus
   - DocumentModule
   - DocumentType

2. Add to AuditAction enum:
```prisma
enum AuditAction {
  // ... existing values
  HANDOVER_CREATED
  HANDOVER_UPDATED
  HANDOVER_SENT_TO_OWNER
  HANDOVER_OWNER_CONFIRMED
  HANDOVER_CHANGES_REQUESTED
  HANDOVER_ADMIN_CONFIRMED
  HANDOVER_COMPLETED
  HANDOVER_CANCELLED
  HANDOVER_PDF_GENERATED
  HANDOVER_MESSAGE_CREATED
  DOCUMENT_CREATED
}
```

3. Add new models:
   - Handover
   - HandoverItem
   - HandoverAttachment
   - HandoverMessage
   - Document

4. Update User model relations:
```prisma
model User {
  // ... existing fields

  // Add these relations
  handoversAsOwner     Handover[]        @relation("HandoverOwner")
  handoversAsAdmin     Handover[]        @relation("HandoverAdmin")
  handoverMessages     HandoverMessage[] @relation("HandoverMessages")
  createdDocuments     Document[]        @relation("DocumentCreator")
}
```

### 3. Run Database Migration

```bash
# Generate migration
npm run prisma:migrate -- --name add_handover_module

# Apply migration
npm run prisma:migrate:deploy

# Generate Prisma client
npm run prisma:generate
```

### 4. Environment Variables

Add these to your `.env` file:

```env
# Cloudflare R2 Configuration (if not already present)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=esnaad-dashboard
R2_PUBLIC_URL=https://your-account.r2.cloudflarestorage.com
R2_CUSTOM_DOMAIN=https://cdn.yourdomain.com  # Optional

# Or use AWS S3 compatible settings
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=esnaad-dashboard
```

### 5. Register Routes in App.ts

Add these routes to your main `app.ts` file:

```typescript
import { createHandoverRoutes } from './modules/handover/routes/handover.routes';
import { createDocumentRoutes } from './modules/docs/routes/document.routes';

// After existing route registrations
app.use('/api/handovers', createHandoverRoutes(prisma));
app.use('/api/docs', createDocumentRoutes(prisma));

// If not already present, add upload routes
app.use('/api/uploads', uploadRoutes);
```

### 6. Update TypeScript Paths (if needed)

Ensure your `tsconfig.json` has these path mappings:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"],
      "@modules/*": ["src/modules/*"],
      "@common/*": ["src/common/*"]
    }
  }
}
```

## Key Features

### State Machine
The Handover module implements a strict state machine with these transitions:

```
DRAFT → SENT_TO_OWNER → OWNER_CONFIRMED → ADMIN_CONFIRMED → COMPLETED
         ↓                ↓
    CHANGES_REQUESTED ←
         ↓
    SENT_TO_OWNER

Any state (except COMPLETED/CANCELLED) → CANCELLED
```

### Permission Model
- **ADMIN**: Can create, edit, send, confirm, complete, cancel handovers
- **OWNER**: Can view their handovers, confirm/reject, request changes, add messages

### PDF Generation
- Uses Puppeteer to generate PDFs from HTML templates
- Handlebars templating for dynamic content
- SHA-256 hash verification for document integrity
- Immutable snapshot ensures PDF never changes

### Audit Logging
All critical actions are logged:
- Handover creation, updates, status changes
- Messages added
- PDF generation
- Cancellation with reasons

## Testing Workflow

1. **Create a handover** (Admin):
```bash
curl -X POST http://localhost:8080/api/handovers \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "unitId": "<unit_id>",
    "ownerId": "<owner_id>",
    "notes": "Test handover"
  }'
```

2. **Send to owner** (Admin):
```bash
curl -X POST http://localhost:8080/api/handovers/<id>/send \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Please review"}'
```

3. **Owner confirms** (Owner):
```bash
curl -X POST http://localhost:8080/api/handovers/<id>/owner-confirm \
  -H "Authorization: Bearer <owner_token>" \
  -H "Content-Type: application/json" \
  -d '{"acknowledgement": "I confirm"}'
```

4. **Admin final confirmation** (Admin):
```bash
curl -X POST http://localhost:8080/api/handovers/<id>/admin-confirm \
  -H "Authorization: Bearer <admin_token>"
```

5. **Complete and generate PDF** (Admin):
```bash
curl -X POST http://localhost:8080/api/handovers/<id>/complete \
  -H "Authorization: Bearer <admin_token>"
```

## Performance Optimizations

1. **Avoid N+1 Queries**: All list endpoints use Prisma `include` statements
2. **Pagination**: All list endpoints support pagination with limits
3. **Indexes**: Database indexes on frequently queried fields:
   - handovers: (unitId, createdAt), (ownerId, createdAt), (status, createdAt)
   - handover_messages: (handoverId, createdAt)
   - handover_items: (handoverId, sortOrder)
   - documents: (module, entityId, createdAt)

4. **Cursor Pagination**: Messages use cursor-based pagination for efficiency

## Troubleshooting

### Puppeteer Issues
If Puppeteer fails to install or run:
```bash
# Install system dependencies (Ubuntu/Debian)
sudo apt-get install -y chromium-browser

# Or use puppeteer-core with system Chrome
npm install puppeteer-core
```

### R2/S3 Connection Issues
- Verify credentials in environment variables
- Check bucket permissions
- Ensure CORS is configured on your bucket

### Migration Errors
If migration fails:
```bash
# Reset and try again (DEVELOPMENT ONLY)
npx prisma migrate reset
npm run prisma:migrate
```

## Production Considerations

1. **PDF Generation**: Consider using a queue system for async PDF generation
2. **File Storage**: Implement CDN for serving files
3. **Rate Limiting**: Add rate limits on file uploads
4. **Monitoring**: Log PDF generation times and failures
5. **Backup**: Regular backups of documents table and R2 bucket
6. **Security**:
   - Validate all file uploads
   - Scan for malware if needed
   - Implement file size limits
   - Use signed URLs with expiration

## API Documentation
See `API_EXAMPLES.md` for comprehensive API examples and workflows.