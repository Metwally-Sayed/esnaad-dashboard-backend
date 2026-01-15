# Unit Documents Module - Complete Documentation

## 📋 Overview

The **Unit Documents Module** (`/src/modules/unit-documents`) is a production-ready system for managing PDF documents (contracts, bills, etc.) associated with property units. It follows the existing architecture patterns and integrates seamlessly with the R2 upload system.

---

## 🎯 Purpose

Manage unit-specific PDF documents with:
- ✅ PDF-only uploads (contracts, bills, other documents)
- ✅ Cloudflare R2 storage integration
- ✅ Role-based access control (ADMIN + OWNER)
- ✅ Presigned upload/download URLs
- ✅ Complete audit logging
- ✅ Paginated list views

---

## 🏗️ Architecture

### Module Structure

```
src/modules/unit-documents/
├── controllers/
│   └── unit-documents.controller.ts   # HTTP request/response handling
├── dto/
│   └── unit-documents.dto.ts          # Zod validation schemas
├── repositories/
│   └── unit-documents.repository.ts   # Prisma database queries
├── routes/
│   ├── unit-documents.routes.ts       # /api/documents/* routes
│   └── unit-nested-documents.routes.ts # /api/units/:unitId/documents/* routes
└── services/
    └── unit-documents.service.ts      # Business logic + permissions
```

---

## 📊 Database Schema

### UnitDocument Model

```prisma
model UnitDocument {
  id               String           @id @default(cuid())
  unitId           String
  title            String
  category         DocumentCategory // CONTRACT, BILL, OTHER
  fileKey          String           // R2 object key
  mimeType         String           // Must be application/pdf
  sizeBytes        Int

  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  // Relations
  unit             Unit             @relation(fields: [unitId], references: [id], onDelete: Cascade)
  uploadedBy       User             @relation("UnitDocumentUploader", fields: [uploadedByUserId], references: [id])

  @@index([unitId, createdAt])
  @@index([category])
  @@index([uploadedByUserId])
  @@map("unit_documents")
}

enum DocumentCategory {
  CONTRACT
  BILL
  OTHER
}
```

### Audit Actions

Added to `AuditAction` enum:
- `UNIT_DOCUMENT_UPLOADED`
- `UNIT_DOCUMENT_DELETED`

---

## 🔧 API Endpoints

### 1. GET /api/units/:unitId/documents

**Purpose:** List all documents for a specific unit

**Permissions:**
- ADMIN: Can view documents for any unit
- OWNER: Can only view documents for units they own

**Query Parameters:**
```typescript
{
  page?: string;          // Page number (default: 1)
  limit?: string;         // Items per page (default: 10)
  sortBy?: string;        // Field to sort by (default: createdAt)
  sortOrder?: 'asc' | 'desc'; // Sort direction (default: desc)
  category?: 'CONTRACT' | 'BILL' | 'OTHER'; // Filter by category
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    data: [{
      id: string;
      unitId: string;
      title: string;
      category: 'CONTRACT' | 'BILL' | 'OTHER';
      fileKey: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: string;
      updatedAt: string;
      uploadedBy: {
        id: string;
        name: string;
        email: string;
        role: 'ADMIN' | 'OWNER';
      };
    }],
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }
  }
}
```

---

### 2. POST /api/units/:unitId/documents

**Purpose:** Upload a new document to a unit

**Permissions:**
- ADMIN: Can upload to any unit
- OWNER: Can only upload to units they own

**Request Body:**
```typescript
{
  title: string;              // Document title (1-200 chars)
  category: 'CONTRACT' | 'BILL' | 'OTHER';
  fileKey: string;            // R2 object key from presigned upload
  mimeType: 'application/pdf'; // Must be PDF
  sizeBytes: number;          // File size (max 10MB)
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    document: {
      id: string;
      unitId: string;
      title: string;
      category: string;
      fileKey: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: string;
      updatedAt: string;
      unit: {
        id: string;
        unitNumber: string;
        buildingName: string;
        ownerId: string;
      };
      uploadedBy: {
        id: string;
        name: string;
        email: string;
        role: string;
      };
    }
  },
  message: 'Document uploaded successfully'
}
```

---

### 3. GET /api/documents (ADMIN ONLY)

**Purpose:** List all documents across all units with advanced filtering

**Permissions:** ADMIN only

**Query Parameters:**
```typescript
{
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  unitId?: string;          // Filter by specific unit
  category?: 'CONTRACT' | 'BILL' | 'OTHER';
  search?: string;          // Search in title or unit number
}
```

**Response:** Same pagination structure as endpoint #1

---

### 4. GET /api/documents/:documentId

**Purpose:** Get a specific document by ID

**Permissions:**
- ADMIN: Can view any document
- OWNER: Can only view documents for units they own

**Response:**
```typescript
{
  success: true,
  data: {
    document: { /* full document object */ }
  }
}
```

---

### 5. GET /api/documents/:documentId/download

**Purpose:** Get presigned R2 download URL for a document

**Permissions:** Same as GET by ID

**Response:**
```typescript
{
  success: true,
  data: {
    downloadUrl: string; // Presigned R2 URL (valid for 1 hour)
  }
}
```

---

### 6. DELETE /api/documents/:documentId

**Purpose:** Delete a document

**Permissions:** ADMIN only

**Response:**
```typescript
{
  success: true,
  data: null,
  message: 'Document deleted successfully'
}
```

---

## 🔄 Complete Upload Workflow

### Step 1: Get Presigned Upload URL

```typescript
const uploadData = await fetch('/api/uploads/r2/presigned-url', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileName: 'contract.pdf',
    mimeType: 'application/pdf',
    sizeBytes: file.size,
    userId: currentUser.id
  })
}).then(r => r.json());

// uploadData.presignedUrl - for upload
// uploadData.key - save this for step 3
```

### Step 2: Upload File to R2

```typescript
await fetch(uploadData.presignedUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/pdf'
  },
  body: file // File blob
});
```

### Step 3: Create Document Record

```typescript
const document = await fetch(`/api/units/${unitId}/documents`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Unit Purchase Contract',
    category: 'CONTRACT',
    fileKey: uploadData.key,
    mimeType: 'application/pdf',
    sizeBytes: file.size
  })
}).then(r => r.json());
```

### Step 4: Download Document

```typescript
// Get download URL
const { downloadUrl } = await fetch(`/api/documents/${documentId}/download`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(d => d.data);

// Open in new tab or download
window.open(downloadUrl, '_blank');
```

---

## 🔐 Permission Matrix

| Endpoint | ADMIN | OWNER |
|----------|-------|-------|
| GET /api/units/:unitId/documents | ✅ Any unit | ✅ Own units only |
| POST /api/units/:unitId/documents | ✅ Any unit | ✅ Own units only |
| GET /api/documents | ✅ Yes | ❌ Forbidden |
| GET /api/documents/:id | ✅ Any document | ✅ Own units only |
| GET /api/documents/:id/download | ✅ Any document | ✅ Own units only |
| DELETE /api/documents/:id | ✅ Yes | ❌ Forbidden |

---

## 💾 TypeScript Types

```typescript
import { DocumentCategory } from '@prisma/client';

interface UnitDocument {
  id: string;
  unitId: string;
  title: string;
  category: DocumentCategory;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  unit?: {
    id: string;
    unitNumber: string;
    buildingName?: string;
    ownerId?: string;
  };
  uploadedBy?: {
    id: string;
    name?: string;
    email: string;
    role: 'ADMIN' | 'OWNER';
  };
}

interface CreateDocumentDto {
  title: string;
  category: DocumentCategory;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
}
```

---

## 🧪 Testing

### Test Script

Run the provided test script:
```bash
./test-documents-module.sh
```

Tests:
1. ✅ Admin login
2. ✅ Create document
3. ✅ List unit documents
4. ✅ Get document by ID
5. ✅ List all documents (admin)
6. ✅ Delete document

### Manual Testing with cURL

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}' \
  | jq -r '.data.accessToken')

# Create document
curl -X POST http://localhost:8080/api/units/UNIT_ID/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Purchase Contract",
    "category": "CONTRACT",
    "fileKey": "contracts/unit-123/contract-2026.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 524288
  }'

# List documents
curl http://localhost:8080/api/units/UNIT_ID/documents \
  -H "Authorization: Bearer $TOKEN"

# Get all documents (admin only)
curl http://localhost:8080/api/documents?category=CONTRACT \
  -H "Authorization: Bearer $TOKEN"

# Delete document
curl -X DELETE http://localhost:8080/api/documents/DOC_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📈 Common Use Cases

### 1. Display Documents in Unit Profile

```typescript
const { data } = await fetch(`/api/units/${unitId}/documents`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

// Group by category
const grouped = data.data.reduce((acc, doc) => {
  if (!acc[doc.category]) acc[doc.category] = [];
  acc[doc.category].push(doc);
  return acc;
}, {});

// Render
<>
  <h3>Contracts</h3>
  {grouped.CONTRACT?.map(doc => <DocumentCard key={doc.id} document={doc} />)}

  <h3>Bills</h3>
  {grouped.BILL?.map(doc => <DocumentCard key={doc.id} document={doc} />)}
</>
```

### 2. Admin Document Management Dashboard

```typescript
const { data } = await fetch('/api/documents?search=Unit A-101', {
  headers: { Authorization: `Bearer ${adminToken}` }
}).then(r => r.json());

// Display all documents with unit info
data.data.map(doc => (
  <tr key={doc.id}>
    <td>{doc.unit.unitNumber}</td>
    <td>{doc.title}</td>
    <td>{doc.category}</td>
    <td>{formatBytes(doc.sizeBytes)}</td>
    <td>{formatDate(doc.createdAt)}</td>
    <td>
      <button onClick={() => download(doc.id)}>Download</button>
      <button onClick={() => deleteDoc(doc.id)}>Delete</button>
    </td>
  </tr>
))
```

### 3. File Size Validation

```typescript
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check type
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Only PDF files are allowed' };
  }

  // Check size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  return { valid: true };
}
```

---

## ⚠️ Important Notes

### ✅ DO

- Always validate file type is `application/pdf` on frontend and backend
- Use presigned URLs for uploads (never upload directly)
- Handle 403 errors gracefully (ownership checks)
- Show file size in human-readable format
- Implement loading states during upload
- Cache document lists with SWR or React Query

### ❌ DON'T

- Don't allow uploads > 10MB
- Don't skip permission checks
- Don't hardcode document IDs
- Don't delete documents without confirmation
- Don't forget to handle R2 upload failures

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Only PDF files are allowed" | Check `mimeType` is exactly `application/pdf` |
| "You can only upload documents for units you own" | Verify user owns the unit or is an ADMIN |
| "Document not found" | Check document ID and permissions |
| 404 on download URL | Verify fileKey exists in R2, check R2 configuration |
| Upload fails silently | Check R2 credentials in environment variables |

---

## 🔒 Security Considerations

- ✅ PDF-only validation on both frontend and backend
- ✅ File size limits enforced (10MB max)
- ✅ Owner can only access/upload to their own units
- ✅ Admin-only delete operations
- ✅ Presigned URLs expire after 1 hour
- ✅ Audit logging for all operations
- ✅ SQL injection prevention via Prisma
- ✅ Input validation with Zod

---

## 📊 Production Checklist

- ✅ Database migration applied
- ✅ Prisma Client regenerated
- ✅ TypeScript compilation successful
- ✅ Routes registered in app.ts
- ✅ Audit actions added to enum
- ✅ Permission checks implemented
- ✅ Validation schemas created
- ✅ Error handling implemented
- ✅ R2 integration tested
- ✅ Documentation complete

---

## 🚀 Status

**Production Ready** ✅

The Unit Documents module is fully implemented, tested, and ready for frontend integration. All endpoints follow existing architecture patterns and include proper:
- Role-based access control
- Audit logging
- Error handling
- Pagination
- Type safety
- Input validation

**Next Steps:**
1. Integrate with frontend unit profile page
2. Implement file upload UI component
3. Add document preview functionality
4. Create admin document management dashboard
