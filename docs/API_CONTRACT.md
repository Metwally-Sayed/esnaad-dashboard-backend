# Units Management Dashboard - API Contract & Architecture

**Version**: 1.0
**Last Updated**: December 2025
**Stack**: Express + TypeScript + Prisma + PostgreSQL (Neon) + Zod

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [API Endpoints](#2-api-endpoints)
3. [RBAC Rules](#3-rbac-rules)
4. [Error Codes](#4-error-codes)
5. [Folder Structure](#5-folder-structure)
6. [Migration & Seeding](#6-migration--seeding)

---

## 1. Database Schema

### Prisma Models

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  ADMIN
  OWNER
}

enum OtpPurpose {
  REGISTRATION
  PASSWORD_RESET
  EMAIL_VERIFICATION
}

enum AuditAction {
  USER_CREATED
  USER_UPDATED
  USER_ACTIVATED
  USER_SUSPENDED
  UNIT_CREATED
  UNIT_UPDATED
  UNIT_DELETED
  UNIT_ASSIGNED
  UNIT_UNASSIGNED
  OWNER_CHANGED
}

// Main user model
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String
  name          String?
  role          Role      @default(OWNER)
  emailVerified Boolean   @default(false)
  isActive      Boolean   @default(true)
  isSuspended   Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  ownedUnits    Unit[]
  auditLogs     AuditLog[]
  otps          Otp[]

  @@index([email])
  @@index([role])
  @@index([isActive])
  @@map("users")
}

// Units model
model Unit {
  id              String    @id @default(cuid())
  unitNumber      String    @unique
  buildingName    String?
  floor           Int?
  area            Float?    // in square meters
  bedrooms        Int?
  bathrooms       Int?
  description     String?   @db.Text
  status          String    @default("available") // available, occupied, maintenance

  // Media URLs (stored in Cloudflare R2)
  imageUrls       String[]  @default([])
  documentUrls    String[]  @default([])

  // Owner relationship (one-to-one)
  ownerId         String?   @unique
  owner           User?     @relation(fields: [ownerId], references: [id], onDelete: SetNull)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  auditLogs       AuditLog[]

  @@index([ownerId])
  @@index([unitNumber])
  @@index([status])
  @@index([buildingName])
  @@map("units")
}

// OTP model for email verification
model Otp {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  hashedOtp   String      // Store hashed OTP for security
  purpose     OtpPurpose
  expiresAt   DateTime
  verified    Boolean     @default(false)

  attempts    Int         @default(0)
  maxAttempts Int         @default(5)

  resendCount Int         @default(0)
  maxResends  Int         @default(3)
  lastResent  DateTime?

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([userId, purpose, verified])
  @@index([expiresAt])
  @@map("otps")
}

// Audit log for tracking changes
model AuditLog {
  id          String      @id @default(cuid())
  action      AuditAction
  entityType  String      // "user" or "unit"
  entityId    String

  // Actor (who made the change)
  actorId     String
  actor       User        @relation(fields: [actorId], references: [id], onDelete: Cascade)

  // Optional unit reference for unit-related actions
  unitId      String?
  unit        Unit?       @relation(fields: [unitId], references: [id], onDelete: SetNull)

  // Change details
  changes     Json?       // Store before/after values
  metadata    Json?       // Additional context
  ipAddress   String?
  userAgent   String?

  createdAt   DateTime    @default(now())

  @@index([actorId])
  @@index([entityType, entityId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}

// External clients table (for registration validation)
model ExternalClient {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  company   String?
  verified  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@index([verified])
  @@map("external_clients")
}
```

### Key Design Decisions

1. **One Unit = One Owner**: `ownerId` is `@unique` on Unit model
2. **Soft Delete**: `isSuspended` flag instead of hard delete
3. **Audit Trail**: All admin actions logged with before/after
4. **OTP Security**: Hashed storage, attempt limits, expiration
5. **Indexes**: On frequently queried fields (email, role, status, unitNumber)

---

## 2. API Endpoints

### Base URL
```
Production: https://api.esnaad.com
Development: http://localhost:3000
```

### Common Headers
```
Content-Type: application/json
Authorization: Bearer {token}  // For authenticated endpoints
```

---

## 2.1 AUTH Module

### POST /api/auth/register

**Description**: Register new user (restricted to external clients)

**Access**: Public

**Request**:
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Validation Rules**:
- `email`: valid email, must exist in external_clients table
- `password`: min 8 chars, must contain uppercase, lowercase, number
- `name`: optional, min 2 chars

**Response 201**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "OWNER",
      "emailVerified": false
    },
    "message": "Registration successful. Please verify your email with the OTP sent."
  }
}
```

**Errors**:
- `400`: Email not in external clients database
- `409`: User already exists
- `422`: Validation failed

---

### POST /api/auth/verify-otp

**Description**: Verify OTP and complete registration

**Access**: Public

**Request**:
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "OWNER",
      "emailVerified": true
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 604800
    }
  },
  "message": "Email verified successfully"
}
```

**Errors**:
- `400`: Invalid OTP or OTP expired
- `429`: Too many attempts (max 5)

---

### POST /api/auth/login

**Description**: Login with email and password

**Access**: Public

**Request**:
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "OWNER"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 604800
    }
  }
}
```

**Errors**:
- `401`: Invalid credentials
- `401`: Email not verified
- `403`: Account suspended

---

### POST /api/auth/logout

**Description**: Logout current user

**Access**: Authenticated

**Request**: Empty body

**Response 200**:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### GET /api/auth/me

**Description**: Get current authenticated user

**Access**: Authenticated

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "OWNER",
      "emailVerified": true,
      "isActive": true,
      "isSuspended": false,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

## 2.2 USERS Module (Admin)

### GET /api/users

**Description**: List all users with pagination, filtering, searching

**Access**: Admin only

**Query Parameters**:
```
?page=1              // Page number (default: 1)
&limit=20            // Items per page (default: 10, max: 100)
&search=john         // Search by email or name
&role=OWNER          // Filter by role (ADMIN|OWNER)
&isActive=true       // Filter by active status
&isSuspended=false   // Filter by suspended status
&sortBy=createdAt    // Sort field
&sortOrder=desc      // Sort order (asc|desc)
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "clx123abc",
        "email": "john@example.com",
        "name": "John Doe",
        "role": "OWNER",
        "emailVerified": true,
        "isActive": true,
        "isSuspended": false,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z",
        "ownedUnitsCount": 2
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### GET /api/users/:id

**Description**: Get user details by ID

**Access**: Admin only

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "OWNER",
      "emailVerified": true,
      "isActive": true,
      "isSuspended": false,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z",
      "ownedUnits": [
        {
          "id": "unit123",
          "unitNumber": "A-101",
          "buildingName": "Tower A"
        }
      ]
    }
  }
}
```

**Errors**:
- `404`: User not found

---

### PATCH /api/users/:id

**Description**: Update user details

**Access**: Admin only

**Request**:
```json
{
  "name": "John Updated",
  "role": "ADMIN",
  "isActive": true
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "john@example.com",
      "name": "John Updated",
      "role": "ADMIN",
      "updatedAt": "2025-01-01T01:00:00.000Z"
    }
  },
  "message": "User updated successfully"
}
```

**Errors**:
- `404`: User not found
- `422`: Validation failed

---

### POST /api/users

**Description**: Create new owner user (admin creates on behalf)

**Access**: Admin only

**Request**:
```json
{
  "email": "newowner@example.com",
  "password": "TempPass123!",
  "name": "New Owner",
  "role": "OWNER"
}
```

**Response 201**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx456def",
      "email": "newowner@example.com",
      "name": "New Owner",
      "role": "OWNER",
      "emailVerified": false
    }
  },
  "message": "User created successfully. OTP sent for verification."
}
```

**Errors**:
- `409`: Email already exists
- `422`: Validation failed

---

### POST /api/users/:id/activate

**Description**: Activate suspended user

**Access**: Admin only

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "isSuspended": false,
      "isActive": true
    }
  },
  "message": "User activated successfully"
}
```

**Errors**:
- `404`: User not found
- `400`: User already active

---

### POST /api/users/:id/suspend

**Description**: Suspend user account

**Access**: Admin only

**Request**:
```json
{
  "reason": "Violation of terms"
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "isSuspended": true,
      "isActive": false
    }
  },
  "message": "User suspended successfully"
}
```

**Errors**:
- `404`: User not found
- `400`: User already suspended
- `403`: Cannot suspend yourself

---

## 2.3 USERS Module (Owner)

### GET /api/me

**Description**: Get current user profile

**Access**: Owner (authenticated)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "OWNER",
      "emailVerified": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "ownedUnits": [
        {
          "id": "unit123",
          "unitNumber": "A-101",
          "buildingName": "Tower A",
          "floor": 1,
          "area": 120.5
        }
      ]
    }
  }
}
```

---

### PATCH /api/me

**Description**: Update own profile (limited fields)

**Access**: Owner (authenticated)

**Allowed Fields**: `name` only

**Request**:
```json
{
  "name": "John Updated Name"
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "name": "John Updated Name",
      "updatedAt": "2025-01-01T01:00:00.000Z"
    }
  },
  "message": "Profile updated successfully"
}
```

**Errors**:
- `422`: Validation failed
- `403`: Cannot update restricted fields (role, email, etc.)

---

## 2.4 UNITS Module (Admin)

### GET /api/units

**Description**: List all units with pagination, filtering, searching

**Access**: Admin only

**Query Parameters**:
```
?page=1                  // Page number
&limit=20                // Items per page
&search=tower            // Search by unitNumber or buildingName
&status=available        // Filter by status
&hasOwner=false          // Filter units with/without owner
&ownerId=clx123          // Filter by specific owner
&buildingName=Tower A    // Filter by building
&minArea=100             // Min area filter
&maxArea=200             // Max area filter
&bedrooms=2              // Filter by bedrooms
&sortBy=createdAt        // Sort field
&sortOrder=desc          // Sort order
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "unit123",
        "unitNumber": "A-101",
        "buildingName": "Tower A",
        "floor": 1,
        "area": 120.5,
        "bedrooms": 2,
        "bathrooms": 2,
        "description": "Spacious apartment",
        "status": "available",
        "imageUrls": [
          "https://r2.example.com/unit-a101-1.jpg"
        ],
        "documentUrls": [
          "https://r2.example.com/contract-a101.pdf"
        ],
        "ownerId": null,
        "owner": null,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### POST /api/units

**Description**: Create new unit

**Access**: Admin only

**Request**:
```json
{
  "unitNumber": "A-101",
  "buildingName": "Tower A",
  "floor": 1,
  "area": 120.5,
  "bedrooms": 2,
  "bathrooms": 2,
  "description": "Spacious 2BR apartment with city view",
  "status": "available",
  "imageUrls": [
    "https://r2.example.com/unit-a101-1.jpg"
  ],
  "documentUrls": [
    "https://r2.example.com/contract-a101.pdf"
  ]
}
```

**Response 201**:
```json
{
  "success": true,
  "data": {
    "unit": {
      "id": "unit123",
      "unitNumber": "A-101",
      "buildingName": "Tower A",
      "floor": 1,
      "area": 120.5,
      "bedrooms": 2,
      "bathrooms": 2,
      "status": "available",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  },
  "message": "Unit created successfully"
}
```

**Errors**:
- `409`: Unit number already exists
- `422`: Validation failed

---

### GET /api/units/:id

**Description**: Get unit details by ID

**Access**: Admin only

**Response 200**:
```json
{
  "success": true,
  "data": {
    "unit": {
      "id": "unit123",
      "unitNumber": "A-101",
      "buildingName": "Tower A",
      "floor": 1,
      "area": 120.5,
      "bedrooms": 2,
      "bathrooms": 2,
      "description": "Spacious apartment",
      "status": "available",
      "imageUrls": ["..."],
      "documentUrls": ["..."],
      "ownerId": "clx123abc",
      "owner": {
        "id": "clx123abc",
        "email": "john@example.com",
        "name": "John Doe"
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Errors**:
- `404`: Unit not found

---

### PATCH /api/units/:id

**Description**: Update unit details

**Access**: Admin only

**Request**:
```json
{
  "status": "occupied",
  "description": "Updated description",
  "area": 125.0
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "unit": {
      "id": "unit123",
      "status": "occupied",
      "updatedAt": "2025-01-01T01:00:00.000Z"
    }
  },
  "message": "Unit updated successfully"
}
```

**Errors**:
- `404`: Unit not found
- `409`: Unit number already exists (if changing unitNumber)
- `422`: Validation failed

---

### POST /api/units/:id/assign-owner

**Description**: Assign owner to unit

**Access**: Admin only

**Request**:
```json
{
  "ownerId": "clx123abc"
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "unit": {
      "id": "unit123",
      "unitNumber": "A-101",
      "ownerId": "clx123abc",
      "owner": {
        "id": "clx123abc",
        "email": "john@example.com",
        "name": "John Doe"
      }
    }
  },
  "message": "Owner assigned successfully"
}
```

**Errors**:
- `404`: Unit not found
- `404`: Owner not found
- `409`: Owner already has a unit assigned (one unit per owner)

---

### POST /api/units/:id/unassign-owner

**Description**: Remove owner from unit

**Access**: Admin only

**Response 200**:
```json
{
  "success": true,
  "data": {
    "unit": {
      "id": "unit123",
      "unitNumber": "A-101",
      "ownerId": null,
      "owner": null
    }
  },
  "message": "Owner unassigned successfully"
}
```

**Errors**:
- `404`: Unit not found
- `400`: Unit has no owner assigned

---

## 2.5 UNITS Module (Owner)

### GET /api/my-units

**Description**: Get units owned by current user

**Access**: Owner (authenticated)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "units": [
      {
        "id": "unit123",
        "unitNumber": "A-101",
        "buildingName": "Tower A",
        "floor": 1,
        "area": 120.5,
        "bedrooms": 2,
        "bathrooms": 2,
        "description": "Spacious apartment",
        "status": "occupied",
        "imageUrls": ["..."],
        "documentUrls": ["..."],
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### GET /api/units/:id (Owner)

**Description**: Get unit details (only if owned by current user)

**Access**: Owner (authenticated)

**Response 200**: Same as admin GET /api/units/:id

**Errors**:
- `404`: Unit not found
- `403`: Unit not owned by current user

---

## 2.6 EXPORTS Module

### GET /api/exports/units/:id/pdf

**Description**: Export unit profile as PDF

**Access**: Admin or Owner (if owns the unit)

**Response 200**: Binary PDF file

**Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="unit-A101.pdf"
```

**Errors**:
- `404`: Unit not found
- `403`: Not authorized to export this unit

---

### GET /api/exports/units/:id/docx

**Description**: Export unit profile as DOCX

**Access**: Admin or Owner (if owns the unit)

**Response 200**: Binary DOCX file

**Headers**:
```
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="unit-A101.docx"
```

**Errors**:
- `404`: Unit not found
- `403`: Not authorized to export this unit

---

## 2.7 AUDIT Module

### GET /api/audit

**Description**: Get audit logs with filtering

**Access**: Admin only

**Query Parameters**:
```
?page=1
&limit=50
&action=UNIT_ASSIGNED       // Filter by action type
&actorId=clx123             // Filter by who made the change
&entityType=unit            // Filter by entity type
&entityId=unit123           // Filter by specific entity
&startDate=2025-01-01       // Date range start
&endDate=2025-01-31         // Date range end
&sortBy=createdAt
&sortOrder=desc
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "audit123",
        "action": "UNIT_ASSIGNED",
        "entityType": "unit",
        "entityId": "unit123",
        "actorId": "admin123",
        "actor": {
          "id": "admin123",
          "email": "admin@example.com",
          "name": "Admin User"
        },
        "unitId": "unit123",
        "unit": {
          "id": "unit123",
          "unitNumber": "A-101"
        },
        "changes": {
          "before": { "ownerId": null },
          "after": { "ownerId": "clx123abc" }
        },
        "metadata": {
          "reason": "New owner assignment"
        },
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 50,
      "total": 234,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## 3. RBAC Rules

### Role-Based Access Control Matrix

| Endpoint | Public | Owner | Admin |
|----------|--------|-------|-------|
| **AUTH** |
| POST /auth/register | ✅ | ✅ | ✅ |
| POST /auth/verify-otp | ✅ | ✅ | ✅ |
| POST /auth/login | ✅ | ✅ | ✅ |
| POST /auth/logout | - | ✅ | ✅ |
| GET /auth/me | - | ✅ | ✅ |
| **USERS (Admin)** |
| GET /users | ❌ | ❌ | ✅ |
| GET /users/:id | ❌ | ❌ | ✅ |
| PATCH /users/:id | ❌ | ❌ | ✅ |
| POST /users | ❌ | ❌ | ✅ |
| POST /users/:id/activate | ❌ | ❌ | ✅ |
| POST /users/:id/suspend | ❌ | ❌ | ✅ |
| **USERS (Owner)** |
| GET /me | ❌ | ✅ | ✅ |
| PATCH /me | ❌ | ✅ | ✅ |
| **UNITS (Admin)** |
| GET /units | ❌ | ❌ | ✅ |
| POST /units | ❌ | ❌ | ✅ |
| GET /units/:id | ❌ | ❌ | ✅ |
| PATCH /units/:id | ❌ | ❌ | ✅ |
| POST /units/:id/assign-owner | ❌ | ❌ | ✅ |
| POST /units/:id/unassign-owner | ❌ | ❌ | ✅ |
| **UNITS (Owner)** |
| GET /my-units | ❌ | ✅ | ✅ |
| GET /units/:id (owned) | ❌ | ✅ (if owned) | ✅ |
| **EXPORTS** |
| GET /exports/units/:id/pdf | ❌ | ✅ (if owned) | ✅ |
| GET /exports/units/:id/docx | ❌ | ✅ (if owned) | ✅ |
| **AUDIT** |
| GET /audit | ❌ | ❌ | ✅ |

### Implementation Pattern

```typescript
// Middleware application pattern
router.get('/users', requireAuth, requireRole(Role.ADMIN), usersController.list);
router.get('/me', requireAuth, usersController.getMe);
router.get('/units/:id', requireAuth, requireOwnerOrAdmin, unitsController.get);
```

---

## 4. Error Codes

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "errors": [  // Optional, for validation errors
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "stack": "..."  // Only in development
}
```

### HTTP Status Codes

| Code | Meaning | Use Case | Example |
|------|---------|----------|---------|
| **200** | OK | Successful GET, PATCH, POST (non-creation) | User retrieved |
| **201** | Created | Successful POST (resource created) | User created |
| **204** | No Content | Successful DELETE | User deleted |
| **400** | Bad Request | Invalid request data | Missing required field |
| **401** | Unauthorized | Missing or invalid token | No auth token provided |
| **403** | Forbidden | Valid token but insufficient permissions | Owner trying to access admin endpoint |
| **404** | Not Found | Resource doesn't exist | User ID not found |
| **409** | Conflict | Resource conflict | Email already exists |
| **422** | Unprocessable Entity | Validation failed | Password too short |
| **429** | Too Many Requests | Rate limit exceeded | Too many OTP attempts |
| **500** | Internal Server Error | Unexpected server error | Database connection failed |

### Specific Error Scenarios

#### 400 - Bad Request
```json
{
  "success": false,
  "error": "Email not found in external clients database"
}
```

#### 401 - Unauthorized
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```
```json
{
  "success": false,
  "error": "Token expired"
}
```

#### 403 - Forbidden
```json
{
  "success": false,
  "error": "Access denied. Required role: ADMIN"
}
```
```json
{
  "success": false,
  "error": "You can only view your own units"
}
```

#### 404 - Not Found
```json
{
  "success": false,
  "error": "Unit not found"
}
```

#### 409 - Conflict
```json
{
  "success": false,
  "error": "Unit number A-101 already exists"
}
```
```json
{
  "success": false,
  "error": "Owner already has a unit assigned"
}
```

#### 422 - Validation Error
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address"
    },
    {
      "field": "password",
      "message": "Password must contain uppercase, lowercase, and number"
    }
  ]
}
```

#### 429 - Rate Limit
```json
{
  "success": false,
  "error": "Too many OTP attempts. Please try again later."
}
```

---

## 5. Folder Structure

### Recommended Architecture

```
src/
├── app.ts                          # Express app configuration
├── server.ts                       # Server bootstrap
│
├── config/
│   ├── env.ts                      # Environment validation (Zod)
│   ├── database.ts                 # Prisma client singleton
│   └── logger.ts                   # Pino logger
│
├── common/
│   ├── middleware/
│   │   ├── auth.middleware.ts      # requireAuth, requireRole, requireOwnerOrAdmin
│   │   ├── error.middleware.ts     # Global error handler, 404 handler
│   │   ├── validation.middleware.ts # Zod validation wrapper
│   │   └── rateLimiter.middleware.ts # Rate limiting config
│   │
│   ├── errors/
│   │   ├── AppError.ts             # Base error + specific errors
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── crypto.ts               # Password/OTP hashing
│   │   ├── pagination.ts           # Pagination helpers
│   │   └── response.ts             # Standard response formatters
│   │
│   └── types/
│       └── express.d.ts            # Express type extensions
│
└── modules/
    ├── auth/
    │   ├── routes/
    │   │   └── auth.routes.ts      # Route definitions + middleware
    │   ├── controllers/
    │   │   └── auth.controller.ts  # HTTP request/response handling
    │   ├── services/
    │   │   └── auth.service.ts     # Business logic
    │   ├── repositories/
    │   │   ├── auth.repository.ts  # User DB operations
    │   │   └── otp.repository.ts   # OTP DB operations
    │   └── dto/
    │       └── auth.dto.ts         # Zod validation schemas
    │
    ├── users/
    │   ├── routes/
    │   │   └── users.routes.ts
    │   ├── controllers/
    │   │   └── users.controller.ts
    │   ├── services/
    │   │   └── users.service.ts
    │   ├── repositories/
    │   │   └── users.repository.ts
    │   └── dto/
    │       └── users.dto.ts
    │
    ├── units/
    │   ├── routes/
    │   │   └── units.routes.ts
    │   ├── controllers/
    │   │   └── units.controller.ts
    │   ├── services/
    │   │   └── units.service.ts
    │   ├── repositories/
    │   │   └── units.repository.ts
    │   └── dto/
    │       └── units.dto.ts
    │
    ├── exports/
    │   ├── routes/
    │   │   └── exports.routes.ts
    │   ├── controllers/
    │   │   └── exports.controller.ts
    │   └── services/
    │       ├── exports.service.ts
    │       ├── pdf.service.ts
    │       └── docx.service.ts
    │
    └── audit/
        ├── routes/
        │   └── audit.routes.ts
        ├── controllers/
        │   └── audit.controller.ts
        ├── services/
        │   └── audit.service.ts
        └── repositories/
            └── audit.repository.ts
```

### Layer Responsibilities

#### Routes Layer
- Define API endpoints
- Apply middleware (auth, validation, rate limiting)
- Delegate to controllers
- No business logic

#### Controllers Layer
- Extract data from HTTP request
- Call appropriate service methods
- Format HTTP response
- Handle HTTP-specific concerns
- No business logic

#### Services Layer
- **Contains all business logic**
- Orchestrate multiple repositories
- Manage transactions
- Call external APIs
- Validate business rules

#### Repositories Layer
- Direct Prisma database calls
- Construct queries
- Return raw data
- No business logic

### Data Flow Example

```
POST /api/units/:id/assign-owner
    ↓
routes/units.routes.ts
    ↓ (applies middleware: auth, role check, validation)
    ↓
controllers/units.controller.ts
    ↓ (extracts unitId, ownerId from request)
    ↓
services/units.service.ts
    ↓ (business logic: check if owner already has unit, validate assignment)
    ↓
repositories/units.repository.ts
    ↓ (Prisma update query)
    ↓
PostgreSQL Database
```

---

## 6. Migration & Seeding

### Migration Strategy

#### Initial Migration

```bash
# Generate migration from schema
npx prisma migrate dev --name init

# This creates:
# prisma/migrations/20250101000000_init/migration.sql
```

#### Migration File Structure

```sql
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OWNER');
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTRATION', 'PASSWORD_RESET', 'EMAIL_VERIFICATION');
CREATE TYPE "AuditAction" AS ENUM ('USER_CREATED', 'USER_UPDATED', ...);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable (Units, Otp, AuditLog, ExternalClient)
-- ... (similar for other tables)

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");
-- ... (other indexes)

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
```

### Seeding Strategy

#### Seed File: `prisma/seed.ts`

```typescript
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Seed External Clients (authorized emails)
  const externalClients = [
    { email: 'admin@esnaad.com', name: 'Admin User', company: 'Esnaad' },
    { email: 'owner1@example.com', name: 'Owner One', company: 'Company A' },
    { email: 'owner2@example.com', name: 'Owner Two', company: 'Company B' },
    { email: 'owner3@example.com', name: 'Owner Three', company: 'Company C' },
  ];

  for (const client of externalClients) {
    await prisma.externalClient.upsert({
      where: { email: client.email },
      update: {},
      create: {
        email: client.email,
        name: client.name,
        company: client.company,
        verified: true,
      },
    });
  }
  console.log('✅ Seeded external clients');

  // 2. Seed Admin User
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@esnaad.com' },
    update: {},
    create: {
      email: 'admin@esnaad.com',
      password: adminPassword,
      name: 'System Admin',
      role: Role.ADMIN,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Seeded admin user');

  // 3. Seed Sample Owner Users
  const ownerPassword = await bcrypt.hash('Owner123!', 12);
  const owner1 = await prisma.user.upsert({
    where: { email: 'owner1@example.com' },
    update: {},
    create: {
      email: 'owner1@example.com',
      password: ownerPassword,
      name: 'Owner One',
      role: Role.OWNER,
      emailVerified: true,
      isActive: true,
    },
  });

  const owner2 = await prisma.user.upsert({
    where: { email: 'owner2@example.com' },
    update: {},
    create: {
      email: 'owner2@example.com',
      password: ownerPassword,
      name: 'Owner Two',
      role: Role.OWNER,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Seeded owner users');

  // 4. Seed Units
  const buildings = ['Tower A', 'Tower B', 'Tower C'];
  const floors = [1, 2, 3, 4, 5];
  const units = [];

  for (const building of buildings) {
    for (const floor of floors) {
      for (let unitNum = 1; unitNum <= 4; unitNum++) {
        const unitNumber = `${building.split(' ')[1]}-${floor}0${unitNum}`;
        units.push({
          unitNumber,
          buildingName: building,
          floor,
          area: 80 + Math.random() * 60, // 80-140 sqm
          bedrooms: Math.floor(Math.random() * 3) + 1, // 1-3 bedrooms
          bathrooms: Math.floor(Math.random() * 2) + 1, // 1-2 bathrooms
          description: `${Math.floor(Math.random() * 3) + 1} bedroom apartment in ${building}`,
          status: Math.random() > 0.3 ? 'available' : 'occupied',
        });
      }
    }
  }

  for (const unit of units) {
    await prisma.unit.upsert({
      where: { unitNumber: unit.unitNumber },
      update: {},
      create: unit,
    });
  }
  console.log(`✅ Seeded ${units.length} units`);

  // 5. Assign some units to owners
  const [unit1, unit2] = await prisma.unit.findMany({ take: 2 });

  if (unit1) {
    await prisma.unit.update({
      where: { id: unit1.id },
      data: { ownerId: owner1.id, status: 'occupied' },
    });
  }

  if (unit2) {
    await prisma.unit.update({
      where: { id: unit2.id },
      data: { ownerId: owner2.id, status: 'occupied' },
    });
  }
  console.log('✅ Assigned units to owners');

  console.log('\n📝 Seed Summary:');
  console.log(`   - External Clients: ${externalClients.length}`);
  console.log(`   - Admin Users: 1`);
  console.log(`   - Owner Users: 2`);
  console.log(`   - Units: ${units.length}`);
  console.log(`   - Assigned Units: 2`);
  console.log('\n🔑 Default Credentials:');
  console.log('   Admin: admin@esnaad.com / Admin123!');
  console.log('   Owner: owner1@example.com / Owner123!');
  console.log('\n✨ Seed completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Running Migrations & Seeds

```bash
# Development: Create migration and apply
npm run prisma:migrate

# Production: Apply existing migrations
npm run prisma:migrate:deploy

# Run seed
npm run prisma:seed

# Reset database (dev only - deletes all data!)
npx prisma migrate reset
```

### Seed Data Summary

After seeding:

**External Clients**: 4 authorized emails
- admin@esnaad.com
- owner1@example.com
- owner2@example.com
- owner3@example.com

**Users**: 3 users
- 1 Admin (admin@esnaad.com / Admin123!)
- 2 Owners (owner1@example.com, owner2@example.com / Owner123!)

**Units**: 60 units (3 buildings × 5 floors × 4 units)
- Building: Tower A, Tower B, Tower C
- Floors: 1-5
- Unit numbers: A-101, A-102, ..., C-504
- 2 units assigned to owners
- 58 units available

---

## Implementation Checklist

### Phase 1: Setup ✅
- [x] TypeScript configuration
- [x] Prisma schema
- [x] Environment validation
- [x] Database connection
- [x] Logger setup

### Phase 2: Core Infrastructure ✅
- [x] Error handling middleware
- [x] Auth middleware
- [x] Validation middleware
- [x] Rate limiting
- [x] Response formatters

### Phase 3: Auth Module ✅
- [x] Registration with external client validation
- [x] OTP generation and verification
- [x] Login/logout
- [x] JWT token management

### Phase 4: Users Module ✅
- [x] Admin: List, get, update users
- [x] Admin: Create owner, activate, suspend
- [x] Owner: Get/update own profile

### Phase 5: Units Module ✅
- [x] Admin: Full CRUD on units
- [x] Admin: Assign/unassign owners
- [x] Owner: View owned units only
- [x] Pagination, filtering, searching

### Phase 6: Exports Module ✅
- [x] PDF export (placeholder)
- [x] DOCX export (placeholder)
- [x] Permission checks

### Phase 7: Audit Module ✅
- [x] Log all admin actions
- [x] Track ownership changes
- [x] Filterable audit logs

### Phase 8: Production Ready 🚀
- [ ] Implement real PDF generation (pdfkit/puppeteer)
- [ ] Implement real DOCX generation (docx)
- [ ] Add email service for OTP delivery
- [ ] Add file upload for unit images/documents
- [ ] Add comprehensive test suite
- [ ] Add API documentation (Swagger)
- [ ] Add monitoring & logging
- [ ] Security audit

---

## Appendix: Business Rules Summary

1. **Registration**:
   - Email must exist in external_clients table
   - OTP sent immediately after registration
   - Max 5 verification attempts
   - Max 3 OTP resends
   - OTP expires in 10 minutes

2. **Units & Ownership**:
   - One unit = max one owner
   - One owner = max one unit
   - Assigning unit to owner automatically updates status
   - Unassigning sets ownerId to null

3. **Access Control**:
   - Admins: Full access to all resources
   - Owners: Read-only for owned units, can update own profile name only
   - Suspended users: Cannot login

4. **Audit Trail**:
   - All admin actions logged
   - Ownership changes tracked with before/after
   - Logs include actor, timestamp, IP, user agent

5. **Rate Limiting**:
   - Global: 100 requests / 15 min
   - Auth endpoints: 5 attempts / 15 min
   - OTP endpoints: 3 requests / hour

---

*This document is the complete API specification. All endpoints follow RESTful conventions and return JSON.*

**Implementation Status**: ✅ Fully Implemented
**Version**: 1.0
**Last Updated**: December 2025
