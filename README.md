# Units Management Dashboard - Backend API

A production-ready TypeScript backend for managing units with role-based access control, OTP verification, audit logging, and document exports.

## 📖 Quick Links

- **[Quick Start Guide](./QUICKSTART.md)** - Get running in 5 minutes
- **[API Contract](./docs/API_CONTRACT.md)** ⭐ - Complete specification (models, endpoints, RBAC, errors)
- **[API Examples](./docs/API_EXAMPLES.md)** - All 24 endpoints with curl examples
- **[Architecture Guide](./docs/STRUCTURE.md)** - Clean architecture explained
- **[Complete Summary](./FINAL_SUMMARY.md)** - Full project overview

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon.tech)
- **ORM**: Prisma
- **Authentication**: JWT with OTP verification
- **Validation**: Zod
- **Logging**: Pino
- **Security**: Helmet, CORS, Rate Limiting

## Architecture

Clean architecture with separation of concerns:

```
Routes → Controllers → Services → Repositories → Prisma → PostgreSQL
```

### Layers

- **Routes**: API endpoint definitions, middleware application
- **Controllers**: HTTP request/response handling
- **Services**: Business logic, orchestration
- **Repositories**: Database operations (Prisma)

## Features

### Authentication & Authorization
- ✅ Restricted registration (email must exist in external_clients table)
- ✅ OTP email verification (6-digit code, hashed storage)
- ✅ JWT-based authentication (access + refresh tokens)
- ✅ Role-based access control (ADMIN, OWNER)
- ✅ Secure password hashing (bcrypt)
- ✅ Rate limiting on auth endpoints

### User Management
- ✅ Admin can list/view/edit/delete all users
- ✅ Owner can view only their own profile
- ✅ Server-side pagination, filtering, sorting, searching
- ✅ Audit logging for user changes

### Units Management
- ✅ Admin: Full CRUD operations on units
- ✅ Admin: Assign/unassign owners to units
- ✅ Owner: Read-only access to owned units
- ✅ Server-side pagination, filtering, sorting, searching
- ✅ Media URLs storage (Cloudflare R2 integration ready)
- ✅ Audit logging for ownership changes

### Exports
- ✅ Export unit profile to PDF
- ✅ Export unit profile to DOCX
- ✅ Permission checks (owner can export own units only)

### Audit Logs
- ✅ Track all admin edits
- ✅ Track ownership changes
- ✅ Filter by action, entity, actor, date range
- ✅ Admin-only access

## Project Structure

```
src/
├── app.ts                          # Express app setup
├── server.ts                       # Server bootstrap
├── config/
│   ├── env.ts                      # Environment validation (Zod)
│   ├── database.ts                 # Prisma client singleton
│   └── logger.ts                   # Pino logger
├── common/
│   ├── middleware/
│   │   ├── auth.middleware.ts      # requireAuth, requireRole
│   │   ├── error.middleware.ts     # Global error handler
│   │   ├── validation.middleware.ts # Zod validation
│   │   └── rateLimiter.middleware.ts
│   ├── errors/
│   │   └── AppError.ts             # Custom error classes
│   ├── utils/
│   │   ├── crypto.ts               # Hashing utilities
│   │   ├── pagination.ts           # Pagination helpers
│   │   └── response.ts             # Response formatters
│   └── types/
│       └── express.d.ts            # Type extensions
└── modules/
    ├── auth/                       # Authentication module
    ├── users/                      # User management
    ├── units/                      # Units management
    ├── exports/                    # Document exports
    └── audit-logs/                 # Audit logging
```

## Getting Started

### Prerequisites

- Node.js >= 18.x
- PostgreSQL (Neon.tech recommended)
- npm or yarn

### Installation

1. **Clone and install dependencies**

```bash
npm install
```

2. **Set up environment variables**

Copy `.env` and update with your values:

```bash
# Update DATABASE_URL with your Neon.tech connection string
# Generate secure secrets for JWT_SECRET and JWT_REFRESH_SECRET
```

3. **Generate Prisma Client**

```bash
npm run prisma:generate
```

4. **Run database migrations**

```bash
npm run prisma:migrate
```

This will create all tables: users, units, otps, audit_logs, external_clients

5. **Seed external clients (optional)**

Create a seed file to populate external_clients table:

```bash
npm run prisma:seed
```

### Running the Server

**Development mode** (with hot reload):

```bash
npm run dev
```

**Production mode**:

```bash
npm run build
npm start
```

Server will start on `http://localhost:3000`

### Database Management

```bash
# Open Prisma Studio (visual database editor)
npm run prisma:studio

# Create new migration
npm run prisma:migrate

# Deploy migrations (production)
npm run prisma:migrate:deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/verify-otp` | Verify OTP | Public |
| POST | `/api/auth/resend-otp` | Resend OTP | Public |
| POST | `/api/auth/login` | Login | Public |
| POST | `/api/auth/logout` | Logout | Authenticated |
| GET | `/api/auth/me` | Get current user | Authenticated |

### Users

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/users` | List all users (paginated) | Admin |
| GET | `/api/users/:id` | Get user by ID | Owner (self) / Admin |
| PUT | `/api/users/:id` | Update user | Admin |
| DELETE | `/api/users/:id` | Delete user | Admin |

### Units

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/units` | List units (paginated, filtered) | Owner (owned) / Admin (all) |
| GET | `/api/units/:id` | Get unit by ID | Owner (owned) / Admin |
| POST | `/api/units` | Create unit | Admin |
| PUT | `/api/units/:id` | Update unit | Admin |
| POST | `/api/units/:id/assign` | Assign owner | Admin |
| POST | `/api/units/:id/unassign` | Unassign owner | Admin |
| DELETE | `/api/units/:id` | Delete unit | Admin |

### Exports

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/exports/units/:id/pdf` | Export unit to PDF | Owner (owned) / Admin |
| GET | `/api/exports/units/:id/docx` | Export unit to DOCX | Owner (owned) / Admin |

### Audit Logs

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/audit-logs` | List all audit logs (paginated) | Admin |
| GET | `/api/audit-logs/entity/:type/:id` | Get logs for entity | Admin |
| GET | `/api/audit-logs/actor/:actorId` | Get logs by actor | Admin |

### Health Check

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/health` | Server health status | Public |

## Request/Response Examples

### Register User

```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "email": "john@example.com",
      "name": "John Doe"
    },
    "message": "Registration successful. Please verify your email with the OTP sent."
  }
}
```

### List Units (Paginated)

```bash
GET /api/units?page=1&limit=10&status=available&search=building&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "clx...",
        "unitNumber": "A-101",
        "buildingName": "Building A",
        "floor": 1,
        "area": 120.5,
        "bedrooms": 2,
        "bathrooms": 2,
        "status": "available",
        "owner": null,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Assign Owner to Unit

```bash
POST /api/units/clx.../assign
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "ownerId": "clx..."
}
```

## Environment Variables

Required variables (see `.env` file):

```env
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# JWT (minimum 32 characters)
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_REFRESH_EXPIRES_IN=30d

# OTP
OTP_EXPIRES_IN_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_MAX_RESENDS=3

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=*
```

## Database Schema

### User
- id (cuid), email (unique), password (hashed), name, role (ADMIN/OWNER)
- emailVerified, isActive, createdAt, updatedAt

### Unit
- id (cuid), unitNumber (unique), buildingName, floor, area, bedrooms, bathrooms
- description, status, imageUrls[], documentUrls[], ownerId
- createdAt, updatedAt

### Otp
- id (cuid), userId, hashedOtp, purpose, expiresAt, verified
- attempts, maxAttempts, resendCount, maxResends, lastResent
- createdAt, updatedAt

### AuditLog
- id (cuid), action, entityType, entityId, actorId, unitId
- changes (JSON), metadata (JSON), ipAddress, userAgent
- createdAt

### ExternalClient
- id (cuid), email (unique), name, company, verified
- createdAt, updatedAt

## Security Features

- ✅ **Password hashing** with bcrypt (12 rounds)
- ✅ **OTP hashing** with SHA-256
- ✅ **JWT tokens** with expiration
- ✅ **Rate limiting** on auth endpoints
- ✅ **Helmet** for security headers
- ✅ **CORS** configuration
- ✅ **Input validation** with Zod
- ✅ **SQL injection prevention** via Prisma
- ✅ **Error handling** without sensitive data leaks

## Production Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Neon.tech

1. Create Neon database
2. Copy connection string to `DATABASE_URL`
3. Run migrations:

```bash
npm run prisma:migrate:deploy
```

### Environment Setup

- Use strong, random JWT secrets (32+ characters)
- Set `NODE_ENV=production`
- Configure proper CORS origins
- Use HTTPS in production
- Set up monitoring and logging

## TODO / Future Enhancements

- [ ] Implement actual PDF generation (pdfkit/puppeteer)
- [ ] Implement actual DOCX generation (docx library)
- [ ] Add email service integration for OTP delivery
- [ ] Add Cloudflare R2 file upload endpoints
- [ ] Implement refresh token rotation
- [ ] Add comprehensive test suite (Jest)
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add request/response logging middleware
- [ ] Implement soft deletes
- [ ] Add data export (CSV, Excel)
- [ ] Add webhooks for events
- [ ] Implement caching (Redis)

## Support

For issues or questions, contact support@esnaad.com

## License

Proprietary - All rights reserved
# esnaad-dashboard-backend
