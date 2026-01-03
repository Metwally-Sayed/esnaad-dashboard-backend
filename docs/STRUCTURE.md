# Project Folder Structure

```
esnaad-dashboard-backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app.ts                          # Express app configuration
│   ├── server.ts                       # Server bootstrap
│   │
│   ├── config/
│   │   ├── env.ts                      # Environment config with Zod validation
│   │   ├── database.ts                 # Prisma client singleton
│   │   └── logger.ts                   # Pino logger configuration
│   │
│   ├── common/
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts      # requireAuth, requireRole
│   │   │   ├── error.middleware.ts     # Global error handler
│   │   │   ├── validation.middleware.ts # Zod validation middleware
│   │   │   └── rateLimiter.middleware.ts
│   │   │
│   │   ├── errors/
│   │   │   ├── AppError.ts             # Custom error classes
│   │   │   └── index.ts
│   │   │
│   │   ├── types/
│   │   │   ├── express.d.ts            # Express type extensions
│   │   │   └── index.ts
│   │   │
│   │   └── utils/
│   │       ├── crypto.ts               # Hash, compare utilities
│   │       ├── pagination.ts           # Pagination helpers
│   │       └── response.ts             # Standard response formatter
│   │
│   └── modules/
│       │
│       ├── auth/
│       │   ├── routes/
│       │   │   └── auth.routes.ts
│       │   ├── controllers/
│       │   │   └── auth.controller.ts
│       │   ├── services/
│       │   │   └── auth.service.ts
│       │   ├── repositories/
│       │   │   ├── auth.repository.ts
│       │   │   └── otp.repository.ts
│       │   └── dto/
│       │       └── auth.dto.ts          # Zod schemas
│       │
│       ├── users/
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
│       ├── units/
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
│       ├── exports/
│       │   ├── routes/
│       │   │   └── exports.routes.ts
│       │   ├── controllers/
│       │   │   └── exports.controller.ts
│       │   └── services/
│       │       ├── exports.service.ts
│       │       ├── pdf.service.ts
│       │       └── docx.service.ts
│       │
│       └── audit-logs/
│           ├── routes/
│           │   └── audit.routes.ts
│           ├── controllers/
│           │   └── audit.controller.ts
│           ├── services/
│           │   └── audit.service.ts
│           └── repositories/
│               └── audit.repository.ts
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Architecture Layers

### Routes Layer
- Define API endpoints
- Apply middleware (auth, validation, rate limiting)
- Delegate to controllers

### Controllers Layer
- Handle HTTP request/response
- Extract request data
- Call services
- Format responses

### Services Layer
- Business logic
- Orchestrate multiple repositories
- Transaction management
- External API calls

### Repositories Layer
- Direct Prisma database calls
- Query construction
- Data mapping

## Data Flow

```
Request → Route → Middleware → Controller → Service → Repository → Prisma → PostgreSQL
                                    ↓
                              Response ← Format ← Result ← Data ← Query ← Result
```
