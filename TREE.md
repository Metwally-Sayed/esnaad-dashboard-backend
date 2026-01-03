# Project Structure Tree

Complete file structure of the Units Management Dashboard Backend.

```
esnaad-dashboard-backend/
│
├── 📄 Configuration Files
│   ├── package.json                    # NPM dependencies and scripts
│   ├── tsconfig.json                   # TypeScript configuration
│   ├── prisma.config.ts                # Prisma configuration
│   ├── .env                            # Environment variables (not in git)
│   ├── .env.example                    # Environment template
│   └── .gitignore                      # Git ignore rules
│
├── 📚 Documentation (Root)
│   ├── README.md                       # Main documentation (API reference)
│   ├── START_HERE.md                   # Entry point for new developers
│   ├── QUICKSTART.md                   # 5-minute setup guide
│   ├── FINAL_SUMMARY.md                # Complete project overview
│   ├── TREE.md                         # This file
│   ├── CLAUDE.md                       # Claude Code instructions
│   └── README.OLD.md                   # Legacy documentation
│
├── 📁 docs/                            # Additional documentation
│   ├── API_EXAMPLES.md                 # All 23 API endpoints with examples
│   ├── STRUCTURE.md                    # Architecture & design patterns
│   ├── PROJECT_SUMMARY.md              # Technical details & breakdown
│   ├── SETUP.md                        # Database setup guide (legacy)
│   └── MCP_SERVERS.md                  # MCP server configuration
│
├── 🗄️ prisma/                         # Database
│   ├── schema.prisma                   # Database schema (5 models)
│   ├── seed.ts                         # Database seeding script
│   └── migrations/                     # Migration files (generated)
│       └── [timestamp]_init/
│           └── migration.sql
│
├── 💻 src/                             # Source code (TypeScript)
│   │
│   ├── 🚀 Entry Points
│   │   ├── app.ts                      # Express app configuration
│   │   └── server.ts                   # Server bootstrap & startup
│   │
│   ├── ⚙️ config/                      # Configuration
│   │   ├── env.ts                      # Environment validation (Zod)
│   │   ├── database.ts                 # Prisma client singleton
│   │   └── logger.ts                   # Pino logger setup
│   │
│   ├── 🔧 common/                      # Shared utilities
│   │   │
│   │   ├── middleware/                 # Express middleware
│   │   │   ├── auth.middleware.ts      # JWT auth, requireAuth, requireRole
│   │   │   ├── error.middleware.ts     # Global error handler
│   │   │   ├── validation.middleware.ts # Zod validation wrapper
│   │   │   └── rateLimiter.middleware.ts # Rate limiting config
│   │   │
│   │   ├── errors/                     # Custom error classes
│   │   │   ├── AppError.ts             # Base + specific errors
│   │   │   └── index.ts                # Barrel export
│   │   │
│   │   ├── utils/                      # Utility functions
│   │   │   ├── crypto.ts               # Password/OTP hashing, generation
│   │   │   ├── pagination.ts           # Pagination helpers & types
│   │   │   └── response.ts             # Standard response formatters
│   │   │
│   │   └── types/                      # TypeScript types
│   │       └── express.d.ts            # Express type extensions (req.user)
│   │
│   └── 📦 modules/                     # Feature modules
│       │
│       ├── auth/                       # Authentication module
│       │   ├── routes/
│       │   │   └── auth.routes.ts      # Auth endpoints
│       │   ├── controllers/
│       │   │   └── auth.controller.ts  # HTTP handlers
│       │   ├── services/
│       │   │   └── auth.service.ts     # Business logic
│       │   ├── repositories/
│       │   │   ├── auth.repository.ts  # User DB operations
│       │   │   └── otp.repository.ts   # OTP DB operations
│       │   └── dto/
│       │       └── auth.dto.ts         # Zod validation schemas
│       │
│       ├── users/                      # User management module
│       │   ├── routes/
│       │   │   └── users.routes.ts
│       │   ├── controllers/
│       │   │   └── users.controller.ts
│       │   ├── services/
│       │   │   └── users.service.ts
│       │   ├── repositories/
│       │   │   └── users.repository.ts
│       │   └── dto/
│       │       └── users.dto.ts
│       │
│       ├── units/                      # Units management module
│       │   ├── routes/
│       │   │   └── units.routes.ts
│       │   ├── controllers/
│       │   │   └── units.controller.ts
│       │   ├── services/
│       │   │   └── units.service.ts
│       │   ├── repositories/
│       │   │   └── units.repository.ts
│       │   └── dto/
│       │       └── units.dto.ts
│       │
│       ├── exports/                    # Document exports module
│       │   ├── routes/
│       │   │   └── exports.routes.ts
│       │   ├── controllers/
│       │   │   └── exports.controller.ts
│       │   └── services/
│       │       └── exports.service.ts
│       │
│       └── audit-logs/                 # Audit logging module
│           ├── routes/
│           │   └── audit.routes.ts
│           ├── controllers/
│           │   └── audit.controller.ts
│           ├── services/
│           │   └── audit.service.ts
│           └── repositories/
│               └── audit.repository.ts
│
├── 📦 node_modules/                    # NPM dependencies (not in git)
│
├── 🏗️ dist/                            # Compiled JavaScript (not in git)
│   └── [generated by 'npm run build']
│
└── 📊 Database (PostgreSQL - Neon.tech)
    ├── User                            # Authentication, roles
    ├── Unit                            # Property units
    ├── Otp                             # OTP verification
    ├── AuditLog                        # Change tracking
    └── ExternalClient                  # Registration whitelist
```

---

## File Count Summary

### Source Code (src/)
- **Entry Points**: 2 files
- **Config**: 3 files
- **Middleware**: 4 files
- **Errors**: 2 files
- **Utils**: 3 files
- **Types**: 1 file
- **Modules**: 23 files (5 modules × ~4-6 files each)

**Total TypeScript Files**: ~38 files

### Database (prisma/)
- **Schema**: 1 file
- **Seed**: 1 file
- **Migrations**: Generated

**Total**: 2 files + migrations

### Documentation
- **Root**: 7 markdown files
- **docs/**: 5 markdown files

**Total**: 12 documentation files

### Configuration
- **Config Files**: 6 files (.env, tsconfig, package, etc.)

---

## Module Architecture

Each module follows the same clean architecture pattern:

```
module/
├── routes/         # API endpoints + middleware
├── controllers/    # HTTP request/response handling
├── services/       # Business logic
├── repositories/   # Database operations (Prisma)
└── dto/           # Validation schemas (Zod)
```

**Data Flow**:
```
HTTP Request
    ↓
Route (+ Middleware: auth, validation, rate limit)
    ↓
Controller (extract data, handle response)
    ↓
Service (business logic)
    ↓
Repository (Prisma queries)
    ↓
Database (PostgreSQL)
```

---

## Key Directories Explained

### `/src/config`
Environment validation, database connection, logger setup. All configuration in one place.

### `/src/common`
Shared code used across all modules. Middleware, utilities, error classes, types.

### `/src/modules`
Feature modules with complete separation. Each module is self-contained with routes, controllers, services, repositories.

### `/prisma`
Database schema, migrations, and seeding. Single source of truth for data models.

### `/docs`
Additional documentation for architecture, examples, and technical details.

---

## File Naming Conventions

- **TypeScript**: `*.ts`
- **Controllers**: `*.controller.ts`
- **Services**: `*.service.ts`
- **Repositories**: `*.repository.ts`
- **Routes**: `*.routes.ts`
- **DTOs**: `*.dto.ts`
- **Config**: `*.config.ts`

---

## Important Files to Know

### Must Read
1. `README.md` - Main documentation
2. `QUICKSTART.md` - Setup guide
3. `src/app.ts` - Express app setup
4. `prisma/schema.prisma` - Database models

### For Development
1. `src/config/env.ts` - Environment variables
2. `src/common/middleware/auth.middleware.ts` - Auth logic
3. `src/common/errors/AppError.ts` - Error handling
4. `docs/API_EXAMPLES.md` - API testing

### For Deployment
1. `.env.example` - Environment template
2. `package.json` - Scripts and dependencies
3. `tsconfig.json` - TypeScript settings
4. `README.md` - Production deployment guide

---

## Total Project Stats

- **Total Files**: ~55+
- **TypeScript Files**: ~38
- **Documentation Files**: 12
- **Lines of Code**: ~5,650
- **API Endpoints**: 23
- **Database Models**: 5
- **Modules**: 5

---

*Last Updated: December 2025*
