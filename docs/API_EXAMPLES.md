# API Testing Examples

Complete collection of API requests for testing the Units Management Dashboard backend.

## Setup

1. Start the server: `npm run dev`
2. Server runs at: `http://localhost:3000`
3. Save tokens from responses for authenticated requests

## Variables

```bash
BASE_URL=http://localhost:3000
ACCESS_TOKEN=<your-access-token>
USER_ID=<user-id>
UNIT_ID=<unit-id>
```

---

## Authentication

### 1. Register New User

```bash
POST {{BASE_URL}}/api/auth/register
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "SecurePass123",
  "name": "Admin User"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "email": "admin@example.com",
      "name": "Admin User"
    },
    "message": "Registration successful. Please verify your email with the OTP sent."
  }
}
```

**Note**: Check server logs for OTP in development mode.

---

### 2. Verify OTP

```bash
POST {{BASE_URL}}/api/auth/verify-otp
Content-Type: application/json

{
  "email": "admin@example.com",
  "otp": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "OWNER"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  },
  "message": "Email verified successfully"
}
```

**Save** the `accessToken` for subsequent requests.

---

### 3. Resend OTP

```bash
POST {{BASE_URL}}/api/auth/resend-otp
Content-Type: application/json

{
  "email": "admin@example.com"
}
```

---

### 4. Login

```bash
POST {{BASE_URL}}/api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "SecurePass123"
}
```

**Response**: Same as verify OTP (returns user + tokens)

---

### 5. Get Current User

```bash
GET {{BASE_URL}}/api/auth/me
Authorization: Bearer {{ACCESS_TOKEN}}
```

---

### 6. Logout

```bash
POST {{BASE_URL}}/api/auth/logout
Authorization: Bearer {{ACCESS_TOKEN}}
```

---

## Users Management

### 7. List All Users (Admin Only)

```bash
GET {{BASE_URL}}/api/users?page=1&limit=10&sortBy=createdAt&sortOrder=desc
Authorization: Bearer {{ACCESS_TOKEN}}
```

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `sortBy` (optional): Field to sort by (default: createdAt)
- `sortOrder` (optional): asc or desc (default: desc)
- `role` (optional): Filter by role (ADMIN or OWNER)
- `search` (optional): Search by email or name
- `isActive` (optional): Filter by active status (true/false)

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "clx...",
        "email": "admin@example.com",
        "name": "Admin User",
        "role": "ADMIN",
        "emailVerified": true,
        "isActive": true,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

---

### 8. Get User by ID

```bash
GET {{BASE_URL}}/api/users/{{USER_ID}}
Authorization: Bearer {{ACCESS_TOKEN}}
```

**Note**: Owners can only view themselves, admins can view any user.

---

### 9. Update User (Admin Only)

```bash
PUT {{BASE_URL}}/api/users/{{USER_ID}}
Authorization: Bearer {{ACCESS_TOKEN}}
Content-Type: application/json

{
  "name": "Updated Name",
  "role": "ADMIN",
  "isActive": true
}
```

---

### 10. Delete User (Admin Only)

```bash
DELETE {{BASE_URL}}/api/users/{{USER_ID}}
Authorization: Bearer {{ACCESS_TOKEN}}
```

---

## Units Management

### 11. List All Units

```bash
GET {{BASE_URL}}/api/units?page=1&limit=10&status=available&sortBy=createdAt&sortOrder=desc
Authorization: Bearer {{ACCESS_TOKEN}}
```

**Query Parameters**:
- `page`, `limit`, `sortBy`, `sortOrder`: Pagination options
- `status` (optional): Filter by status (available, occupied, maintenance)
- `search` (optional): Search by unit number or building name
- `ownerId` (optional, admin only): Filter by owner
- `hasOwner` (optional): Filter units with/without owner (true/false)

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "clx...",
        "unitNumber": "A-101",
        "buildingName": "Tower A",
        "floor": 1,
        "area": 120.5,
        "bedrooms": 2,
        "bathrooms": 2,
        "description": "Spacious 2BR apartment",
        "status": "available",
        "imageUrls": [],
        "documentUrls": [],
        "ownerId": null,
        "owner": null,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

---

### 12. Get Unit by ID

```bash
GET {{BASE_URL}}/api/units/{{UNIT_ID}}
Authorization: Bearer {{ACCESS_TOKEN}}
```

---

### 13. Create Unit (Admin Only)

```bash
POST {{BASE_URL}}/api/units
Authorization: Bearer {{ACCESS_TOKEN}}
Content-Type: application/json

{
  "unitNumber": "A-101",
  "buildingName": "Tower A",
  "floor": 1,
  "area": 120.5,
  "bedrooms": 2,
  "bathrooms": 2,
  "description": "Spacious 2-bedroom apartment with city view",
  "status": "available",
  "imageUrls": [
    "https://r2.example.com/unit-a101-1.jpg",
    "https://r2.example.com/unit-a101-2.jpg"
  ],
  "documentUrls": [
    "https://r2.example.com/unit-a101-contract.pdf"
  ]
}
```

---

### 14. Update Unit (Admin Only)

```bash
PUT {{BASE_URL}}/api/units/{{UNIT_ID}}
Authorization: Bearer {{ACCESS_TOKEN}}
Content-Type: application/json

{
  "status": "occupied",
  "description": "Updated description"
}
```

---

### 15. Assign Owner to Unit (Admin Only)

```bash
POST {{BASE_URL}}/api/units/{{UNIT_ID}}/assign
Authorization: Bearer {{ACCESS_TOKEN}}
Content-Type: application/json

{
  "ownerId": "clx..."
}
```

---

### 16. Unassign Owner from Unit (Admin Only)

```bash
POST {{BASE_URL}}/api/units/{{UNIT_ID}}/unassign
Authorization: Bearer {{ACCESS_TOKEN}}
```

---

### 17. Delete Unit (Admin Only)

```bash
DELETE {{BASE_URL}}/api/units/{{UNIT_ID}}
Authorization: Bearer {{ACCESS_TOKEN}}
```

---

## Exports

### 18. Export Unit to PDF

```bash
GET {{BASE_URL}}/api/exports/units/{{UNIT_ID}}/pdf
Authorization: Bearer {{ACCESS_TOKEN}}
```

**Response**: Binary PDF file

---

### 19. Export Unit to DOCX

```bash
GET {{BASE_URL}}/api/exports/units/{{UNIT_ID}}/docx
Authorization: Bearer {{ACCESS_TOKEN}}
```

**Response**: Binary DOCX file

---

## Audit Logs (Admin Only)

### 20. List All Audit Logs

```bash
GET {{BASE_URL}}/api/audit-logs?page=1&limit=20&action=UNIT_CREATED&startDate=2025-01-01
Authorization: Bearer {{ACCESS_TOKEN}}
```

**Query Parameters**:
- `page`, `limit`, `sortBy`, `sortOrder`: Pagination options
- `action` (optional): Filter by action type
- `entityType` (optional): Filter by entity type (user, unit)
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "clx...",
        "action": "UNIT_CREATED",
        "entityType": "unit",
        "entityId": "clx...",
        "actorId": "clx...",
        "actor": {
          "id": "clx...",
          "email": "admin@example.com",
          "name": "Admin User",
          "role": "ADMIN"
        },
        "unitId": "clx...",
        "unit": {
          "id": "clx...",
          "unitNumber": "A-101",
          "buildingName": "Tower A"
        },
        "changes": {
          "created": { ... }
        },
        "metadata": null,
        "ipAddress": null,
        "userAgent": null,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "meta": { ... }
  }
}
```

---

### 21. Get Audit Logs for Specific Entity

```bash
GET {{BASE_URL}}/api/audit-logs/entity/unit/{{UNIT_ID}}
Authorization: Bearer {{ACCESS_TOKEN}}
```

---

### 22. Get Audit Logs by Actor

```bash
GET {{BASE_URL}}/api/audit-logs/actor/{{USER_ID}}
Authorization: Bearer {{ACCESS_TOKEN}}
```

---

## Health Check

### 23. Check Server Health

```bash
GET {{BASE_URL}}/health
```

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "environment": "development"
}
```

---

## Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {
      "path": "email",
      "message": "Invalid email address"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Access denied. Required roles: ADMIN"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Unit not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": "Unit number already exists"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Testing Workflow

### Complete Registration Flow

1. **Register** → Get user ID
2. **Verify OTP** → Get access token
3. **Upgrade to Admin** (via Prisma Studio)
4. **Login** → Get fresh token
5. **Create Units** → Test CRUD
6. **Create Owner User** → Register another user
7. **Assign Owner** → Test ownership
8. **Test Owner Access** → Login as owner, verify can only see owned units
9. **Check Audit Logs** → Verify all actions logged

### Pagination Testing

```bash
# Page 1
GET /api/units?page=1&limit=5

# Page 2
GET /api/units?page=2&limit=5

# Sort by area ascending
GET /api/units?sortBy=area&sortOrder=asc

# Search
GET /api/units?search=tower

# Filter available units
GET /api/units?status=available

# Combine filters
GET /api/units?status=available&hasOwner=false&page=1&limit=10
```

---

## Tips

1. **Save tokens**: Store access tokens in environment variables
2. **Check logs**: OTP codes appear in server logs (dev mode)
3. **Use Prisma Studio**: Quick way to view/edit data
4. **Rate limits**: Auth endpoints are rate-limited (5 attempts per 15 min)
5. **Token expiry**: Access tokens expire in 7 days (configurable)

## Postman Collection

To import into Postman:
1. Create new collection
2. Add environment with `BASE_URL` and `ACCESS_TOKEN` variables
3. Import these requests
4. Use `{{BASE_URL}}` and `{{ACCESS_TOKEN}}` in requests

Happy testing! 🚀
