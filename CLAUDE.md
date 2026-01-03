# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Esnaad Dashboard Backend** - Production-ready TypeScript backend for managing real estate units with role-based access control, OTP verification, audit logging, and project management.

## Tech Stack

- **Runtime**: Node.js + TypeScript (CommonJS modules)
- **Framework**: Express.js v5.x
- **Database**: PostgreSQL (Neon.tech)
- **ORM**: Prisma v6.19.1 (⚠️ Do NOT upgrade to v7 - incompatible)
- **Validation**: Zod v4.x
- **Auth**: JWT with OTP verification
- **Logger**: Pino
- **Security**: Helmet, CORS, Rate Limiting

## Development Commands

### Running the Application

```bash
# Development (hot reload with tsx)
npm run dev                        # Server runs on port 3000 (default), configurable via PORT in .env

# Production build
npm run build                      # Compiles TypeScript to dist/
npm start                          # Runs compiled code from dist/

# Database operations
npm run prisma:generate            # Generate Prisma Client (required after schema changes)
npm run prisma:migrate             # Create and apply migration (dev) - prompts for migration name
npm run prisma:migrate:deploy      # Apply migrations (production)
npm run prisma:studio              # Open Prisma Studio at http://localhost:5555 (visual DB editor)
npm run prisma:seed                # Seed database with test data (runs prisma/seed.ts)

# Testing (placeholder - no test suite implemented yet)
npm test                           # Currently returns error - tests not configured
```

### Critical Database Workflow

When modifying Prisma schema:
1. Edit `prisma/schema.prisma`
2. Run `npm run prisma:migrate` (creates migration + generates client)
3. If migration fails, run `npm run prisma:generate` separately

⚠️ **Prisma Version Lock**: Project uses Prisma 6.19.1. Do NOT upgrade to v7 without updating database configuration.

## TypeScript Configuration

### Path Aliases
The project uses TypeScript path aliases for cleaner imports:
- `@/*` → `src/*`
- `@config/*` → `src/config/*`
- `@modules/*` → `src/modules/*`
- `@common/*` → `src/common/*`

Example usage:
```typescript
import { requireAuth } from '@common/middleware/auth.middleware';
import { UserService } from '@modules/users/services/user.service';
```

**Note**: These aliases work in development (`tsx`) but ensure build process resolves them correctly.

## Architecture Overview

### Clean Architecture Pattern

```
HTTP Request
    ↓
Routes (API endpoint definitions)
    ↓
Middleware (auth, validation, rate limiting)
    ↓
Controllers (request/response handling)
    ↓
Services (business logic)
    ↓
Repositories (database operations)
    ↓
Prisma Client
    ↓
PostgreSQL Database
```

### Module Structure

Each feature follows the same pattern:

```
src/modules/{feature}/
├── routes/{feature}.routes.ts      # Express routes + middleware
├── controllers/{feature}.controller.ts  # Request handlers
├── services/{feature}.service.ts   # Business logic
├── repositories/{feature}.repository.ts # DB queries
└── dto/{feature}.dto.ts            # Zod validation schemas
```

**Example**: Units module
- `units.routes.ts` → Defines `/api/units` endpoints with auth middleware
- `units.controller.ts` → Handles HTTP layer, calls service methods
- `units.service.ts` → Implements business logic, permission checks, audit logging
- `units.repository.ts` → Prisma queries (findAll, findById, create, update, delete)
- `units.dto.ts` → Zod schemas for request validation

## Key Architectural Concepts

### 1. Role-Based Access Control (RBAC)

Two roles defined in Prisma enum:
- **ADMIN**: Full access to all resources
- **OWNER**: Can only view/manage their own units

Middleware implementation:
```typescript
// In routes file
router.use(requireAuth);                    // All routes need authentication
router.get('/', requireRole(Role.ADMIN));   // Admin-only endpoint
router.get('/me', requireAuth);             // Any authenticated user
```

Permission logic in services:
```typescript
// OWNERs can only see their own data
if (requestingUser.role === Role.OWNER) {
  where.ownerId = requestingUser.id;
}
```

### 2. Authentication Flow

**Registration**:
1. User submits email (must exist in `external_clients` table)
2. System generates 6-digit OTP, hashes it, stores in `otps` table
3. OTP sent via email (placeholder - email service not implemented)
4. User verifies OTP with `/api/auth/verify-otp`
5. Account activated, user can login

**Login**:
1. User submits email + password
2. System verifies password (bcrypt), checks `emailVerified` flag
3. Returns access token (7 days) + refresh token (30 days)

**Token Usage**:
- Access token sent in `Authorization: Bearer <token>` header
- `requireAuth` middleware extracts and verifies token
- Decoded payload attached to `req.user`

### 3. Audit Logging Pattern

All create/update/delete operations must log to `audit_logs` table:

```typescript
await prisma.auditLog.create({
  data: {
    action: AuditAction.UNIT_CREATED,  // From Prisma enum
    entityType: 'unit',                // "user", "unit", "project"
    entityId: unit.id,
    actorId: requestingUser.id,
    changes: { created: data },        // JSON: before/after values
  },
});
```

**Audit Actions** (see `schema.prisma`):
- User: `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`
- Unit: `UNIT_CREATED`, `UNIT_UPDATED`, `UNIT_DELETED`, `UNIT_ASSIGNED`, `UNIT_UNASSIGNED`
- Project: `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_DELETED`

### 4. Server-Side Pagination

All list endpoints use consistent pagination pattern:

```typescript
// Query params
?page=1&limit=10&sortBy=createdAt&sortOrder=desc&search=term

// Response format
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

Utilities in `src/common/utils/pagination.ts`:
- `getPaginationParams()` - Parse and validate query params
- `getPrismaSkipTake()` - Convert to Prisma skip/take
- `createPaginatedResponse()` - Format response with meta

### 5. Validation with Zod v4

Zod schemas defined in DTO files, applied via middleware:

```typescript
// In DTO file
export const createUnitSchema = z.object({
  body: z.object({
    unitNumber: z.string().min(1),
    projectId: z.string().optional(),
    // ...
  }),
});

// In routes file
router.post('/', validate(createUnitSchema), controller.create);
```

⚠️ **Zod v4 API Changes**:
- Use `err.issues` not `err.errors`
- Use `z.ZodObject<any>` not `AnyZodObject`

## Data Model

### Core Models (see `prisma/schema.prisma`)

**User** (Authentication + RBAC)
- `id`, `email`, `password` (bcrypt), `name`, `role` (ADMIN/OWNER)
- `emailVerified`, `isActive`
- Relations: `ownedUnits[]`, `auditLogs[]`, `otps[]`

**Project** (Real Estate Projects)
- `id`, `name`, `description`, `location`, `startDate`, `endDate`, `status`, `imageUrl`
- Relations: `units[]` (one-to-many)
- Statuses: "active", "completed", "on-hold"

**Unit** (Real Estate Units)
- `id`, `unitNumber` (unique), `buildingName`, `floor`, `area`, `bedrooms`, `bathrooms`
- `status` (available/occupied/maintenance), `imageUrls[]`, `documentUrls[]`
- Foreign keys: `ownerId` (User), `projectId` (Project)

**ExternalClient** (Registration Whitelist)
- Only users with email in this table can register
- Used for client validation during signup

**Otp** (Email Verification)
- `hashedOtp`, `purpose`, `expiresAt`, `attempts`, `resendCount`
- Rate limiting: max 5 attempts, max 3 resends

**AuditLog** (Change Tracking)
- `action`, `entityType`, `entityId`, `actorId`
- `changes` (JSON with before/after), `metadata`, `ipAddress`

### Important Relationships

```
User (OWNER role)
  ↓ ownerId
Unit
  ↓ projectId
Project

User (ADMIN role)
  ↓ actorId
AuditLog
```

## API Endpoints Overview

### Authentication (`/api/auth`)
- `POST /register` - Register with email verification
- `POST /verify-otp` - Verify 6-digit OTP
- `POST /resend-otp` - Resend OTP (max 3 times)
- `POST /login` - Login with email/password
- `POST /logout` - Logout (placeholder)
- `GET /me` - Get current user profile

### Users (`/api/users`)
- `GET /` - List all users (Admin only, paginated)
- `GET /:id` - Get user by ID (Admin or self)
- `PUT /:id` - Update user (Admin only)
- `DELETE /:id` - Delete user (Admin only)

### Projects (`/api/projects`)
- `GET /` - List projects (paginated, searchable by name/location, filterable by status)
- `GET /:id` - Get project with units
- `POST /` - Create project (Admin only)
- `PATCH /:id` - Update project (Admin only)
- `DELETE /:id` - Delete project (Admin only)

### Units (`/api/units`)
- `GET /` - List units (OWNERs see owned only, paginated, filterable)
- `GET /:id` - Get unit by ID
- `POST /` - Create unit with optional `projectId` (Admin only)
- `PUT /:id` - Update unit (Admin only)
- `POST /:id/assign` - Assign owner (Admin only, creates audit log)
- `POST /:id/unassign` - Unassign owner (Admin only)
- `DELETE /:id` - Delete unit (Admin only)

### Exports (`/api/exports`)
- `GET /units/:id/pdf` - Export unit profile to PDF (placeholder)
- `GET /units/:id/docx` - Export unit to DOCX (placeholder)

### Audit Logs (`/api/audit-logs`)
- `GET /` - List all logs (Admin only, filterable by action/entity/actor/date)
- `GET /entity/:type/:id` - Get logs for specific entity
- `GET /actor/:actorId` - Get logs by actor

## Environment Configuration

Required variables in `.env`:

```env
NODE_ENV=development
PORT=3000                          # Backend port (default: 3000)

DATABASE_URL="postgresql://..."   # Neon.tech connection string

JWT_SECRET="..."                   # Min 32 chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET="..."           # Min 32 chars
JWT_REFRESH_EXPIRES_IN=30d

OTP_EXPIRES_IN_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_MAX_RESENDS=3

RATE_LIMIT_WINDOW_MS=900000        # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

CORS_ORIGIN=*                      # Comma-separated in production
```

## Development Workflow Tips

### Quick Development Setup
```bash
# Fresh start (reset DB and reseed)
npx prisma migrate reset
npm run prisma:seed
npm run dev
```

### Working with OTP in Development
Since email service is not implemented, during development:
1. OTP is logged to console when generated
2. Use Prisma Studio to check hashed OTP: `npm run prisma:studio`
3. Default OTP expiry: 10 minutes
4. Max attempts: 5, Max resends: 3

### Making a User Admin
After registration, to grant admin privileges:
```bash
npm run prisma:studio
# Navigate to User table → Find user → Change role to ADMIN
```

## Common Development Patterns

### Adding a New Module

1. Create directory: `src/modules/{feature}/`
2. Create DTO file with Zod schemas
3. Create repository with Prisma queries
4. Create service with business logic + audit logging
5. Create controller with request handlers
6. Create routes with middleware
7. Register in `src/app.ts`: `app.use('/api/{feature}', {feature}Routes)`

### Adding a New Prisma Model

1. Edit `prisma/schema.prisma`
2. Add `@@map("table_name")` for consistent naming
3. Add indexes for foreign keys and frequently queried fields
4. Run `npm run prisma:migrate` (creates migration + generates client)
5. Update TypeScript types if needed
6. Add to seed file if appropriate

### Adding Audit Logging

1. Add action to `AuditAction` enum in schema
2. In service method, after DB operation:
```typescript
await prisma.auditLog.create({
  data: {
    action: AuditAction.YOUR_ACTION,
    entityType: 'your-entity',
    entityId: entity.id,
    actorId: requestingUser.id,
    changes: { old: existingData, new: updateData },
  },
});
```

## Common Issues & Solutions

### TypeScript Errors After Schema Changes
**Problem**: `Module '"@prisma/client"' has no exported member 'PrismaClient'`
**Solution**: Run `npm run prisma:generate`

### Migration Fails
**Problem**: Schema changes conflict with existing data
**Solution**:
1. Check migration SQL in `prisma/migrations/`
2. Manually fix data conflicts in DB
3. Use `npx prisma migrate resolve --applied <migration-name>` if needed
4. For complete reset: `npx prisma migrate reset` (WARNING: deletes all data)

### Port Already in Use
**Problem**: Port 3000 already occupied
**Solution**:
- Change `PORT` in `.env` file
- Or kill existing process: `lsof -i :3000` then `kill -9 <PID>`

### OTP Not Working
**Problem**: Email service not implemented
**Solution**:
1. Check server logs in development mode - OTP is logged to console
2. Or check DB directly in Prisma Studio (`npm run prisma:studio`)
3. Look in the `otps` table for the hashed OTP

### TypeScript Path Aliases Not Working
**Problem**: Build fails with module not found errors
**Solution**: Path aliases (`@/`, `@config/`, etc.) only work with `tsx` in dev mode. For production builds, may need to add a module alias resolver.

### User Registration Fails
**Problem**: "Email not found in authorized external clients"
**Solution**: User's email must exist in `external_clients` table. Add via seed file or Prisma Studio.

## Important Files

- `src/app.ts` - Express app configuration (middleware, routes)
- `src/server.ts` - Server bootstrap (database connection, port binding)
- `src/config/env.ts` - Environment validation with Zod
- `src/config/database.ts` - Prisma client singleton
- `src/common/middleware/auth.middleware.ts` - `requireAuth`, `requireRole`
- `src/common/middleware/error.middleware.ts` - Global error handler
- `src/common/errors/AppError.ts` - Custom error classes
- `prisma/schema.prisma` - Database schema (source of truth)
- `prisma/seed.ts` - Database seeding script

## Testing the API

### Quick Start Testing

1. Seed database: `npm run prisma:seed`
2. Login as admin:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'
```
3. Extract `accessToken` from response
4. Use in subsequent requests:
```bash
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer <token>"
```

### Default Seeded Users

When using `npm run prisma:seed` with the default seed file:

- **Admin**: `admin@example.com` / `Admin123!` (role: ADMIN)
- **Owner 1**: `owner1@example.com` / `Owner123!` (role: OWNER)
- **Owner 2**: `owner2@example.com` / `Owner123!` (role: OWNER)

**Note**: These users must first be added to `external_clients` table before they can register. The seed file handles this automatically.

See `prisma/seed.ts` for full seed data including sample units and projects.

## Documentation References

- [API Contract](./docs/API_CONTRACT.md) - Complete API specification
- [API Examples](./docs/API_EXAMPLES.md) - All 24 endpoints with curl
- [Architecture Guide](./docs/STRUCTURE.md) - Detailed architecture
- [Quick Start](./QUICKSTART.md) - 5-minute setup guide
- [README](./README.md) - Project overview
