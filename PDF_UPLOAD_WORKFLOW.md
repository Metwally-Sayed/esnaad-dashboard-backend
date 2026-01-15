# PDF Document Upload Workflow - Complete Guide

## 🎯 Overview

Complete 3-step workflow for uploading PDF documents to units using Cloudflare R2 storage.

---

## 📋 Step-by-Step Process

### **Step 1: Get Presigned Upload URL**

**Endpoint:** `POST /api/documents/presign`

**Request:**
```http
POST http://localhost:8080/api/documents/presign
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "fileName": "contract-2026.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 524288
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "presignedUrl": "https://esnaad-dashbaord.xxx.r2.cloudflarestorage.com/unit-documents/...",
    "publicUrl": "https://pub-xxx.r2.dev/unit-documents/user-id/timestamp_unique.pdf",
    "fileKey": "unit-documents/user-id/timestamp_unique.pdf",
    "expiresIn": 3600,
    "instructions": {
      "method": "PUT",
      "headers": {
        "Content-Type": "application/pdf"
      }
    }
  }
}
```

**Important:**
- Save `fileKey` for Step 3
- Save `publicUrl` (this will be the final document URL)
- `presignedUrl` expires in 1 hour

---

### **Step 2: Upload PDF to R2**

**Endpoint:** Use the `presignedUrl` from Step 1

**Request:**
```http
PUT {presignedUrl}
Content-Type: application/pdf
Body: <Binary PDF file data>
```

**cURL Example:**
```bash
curl -X PUT "${PRESIGNED_URL}" \
  -H "Content-Type: application/pdf" \
  --data-binary @"/path/to/your/file.pdf"
```

**JavaScript Example:**
```javascript
const file = document.getElementById('fileInput').files[0];

const response = await fetch(presignedUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/pdf'
  },
  body: file
});

if (response.ok) {
  console.log('Upload successful!');
}
```

---

### **Step 3: Create Document Record**

**Endpoint:** `POST /api/units/:unitId/documents`

**Request:**
```http
POST http://localhost:8080/api/units/{unitId}/documents
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "Unit Purchase Contract 2026",
  "category": "CONTRACT",
  "fileKey": "unit-documents/user-id/timestamp_unique.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 524288
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "document": {
      "id": "cmk123...",
      "unitId": "unit-id",
      "title": "Unit Purchase Contract 2026",
      "category": "CONTRACT",
      "fileKey": "unit-documents/...",
      "mimeType": "application/pdf",
      "sizeBytes": 524288,
      "createdAt": "2026-01-05T00:00:00.000Z",
      "uploadedBy": {
        "id": "user-id",
        "name": "Admin User",
        "email": "admin@example.com"
      }
    }
  },
  "message": "Document uploaded successfully"
}
```

---

## 💻 Complete Frontend Implementation

### **React/TypeScript Example**

```typescript
import { useState } from 'react';

interface UploadResponse {
  presignedUrl: string;
  publicUrl: string;
  fileKey: string;
  expiresIn: number;
}

const DocumentUpload = ({ unitId, token }: { unitId: string; token: string }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadDocument = async (file: File, category: 'CONTRACT' | 'BILL' | 'OTHER') => {
    setUploading(true);
    setProgress(0);

    try {
      // STEP 1: Get presigned URL
      setProgress(10);
      const presignResponse = await fetch('/api/documents/presign', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: 'application/pdf',
          sizeBytes: file.size
        })
      });

      const { data }: { data: UploadResponse } = await presignResponse.json();
      setProgress(20);

      // STEP 2: Upload to R2
      const uploadResponse = await fetch(data.presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf'
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }
      setProgress(70);

      // STEP 3: Create document record
      const documentResponse = await fetch(`/api/units/${unitId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: file.name.replace('.pdf', ''),
          category: category,
          fileKey: data.fileKey,
          mimeType: 'application/pdf',
          sizeBytes: file.size
        })
      });

      const result = await documentResponse.json();
      setProgress(100);

      if (result.success) {
        alert('Document uploaded successfully!');
        return result.data.document;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (file.type !== 'application/pdf') {
      alert('Only PDF files are allowed');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must not exceed 10MB');
      return;
    }

    await uploadDocument(file, 'CONTRACT');
  };

  return (
    <div>
      <input
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && (
        <div>
          <progress value={progress} max="100" />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
```

---

## 🔐 Validation Rules

### **Frontend Validation**
```javascript
function validatePDF(file) {
  const errors = [];

  // Check file type
  if (file.type !== 'application/pdf') {
    errors.push('Only PDF files are allowed');
  }

  // Check file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push('File size must not exceed 10MB');
  }

  // Check file name
  if (file.name.length > 200) {
    errors.push('File name is too long');
  }

  return errors;
}
```

### **Backend Validation** (Automatic)
- ✅ `mimeType` must be `application/pdf`
- ✅ `sizeBytes` max 10MB (10,485,760 bytes)
- ✅ `fileName` required (1-200 characters)
- ✅ JWT authentication required
- ✅ Unit ownership verified (OWNER) or ADMIN role

---

## 📊 Example Response Flow

### **Success Case:**

```
1. POST /api/documents/presign
   → 200 OK { presignedUrl, fileKey, publicUrl }

2. PUT {presignedUrl}
   → 200 OK (no body)

3. POST /api/units/:unitId/documents
   → 201 Created { document }

✅ Document uploaded and saved!
```

### **Error Cases:**

```
❌ Step 1 Fails:
   - Invalid file type → 400 "Only PDF files are allowed"
   - File too large → 400 "File size must not exceed 10MB"

❌ Step 2 Fails:
   - Invalid presigned URL → 403 Forbidden
   - Expired URL → 400 Bad Request

❌ Step 3 Fails:
   - Unit not found → 404 "Unit not found"
   - Not owner → 403 "You can only upload documents for units you own"
   - Wrong fileKey → 400 validation error
```

---

## 🧪 Testing with cURL

### **Complete Workflow Test:**

```bash
#!/bin/bash

# Step 0: Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}' \
  | jq -r '.data.tokens.accessToken')

# Get unit ID
UNIT_ID=$(curl -s -X GET "http://localhost:8080/api/units?limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data.data[0].id')

# Step 1: Get presigned URL
PRESIGN_DATA=$(curl -s -X POST http://localhost:8080/api/documents/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-contract.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 524288
  }')

PRESIGNED_URL=$(echo $PRESIGN_DATA | jq -r '.data.presignedUrl')
FILE_KEY=$(echo $PRESIGN_DATA | jq -r '.data.fileKey')

echo "Presigned URL obtained: ${PRESIGNED_URL:0:50}..."

# Step 2: Upload file (using a test PDF)
curl -X PUT "$PRESIGNED_URL" \
  -H "Content-Type: application/pdf" \
  --data-binary @"/path/to/test.pdf"

# Step 3: Create document record
curl -X POST "http://localhost:8080/api/units/$UNIT_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Contract 2026\",
    \"category\": \"CONTRACT\",
    \"fileKey\": \"$FILE_KEY\",
    \"mimeType\": \"application/pdf\",
    \"sizeBytes\": 524288
  }" | jq

echo "✅ Document uploaded successfully!"
```

---

## 🎯 Quick Reference

### **Endpoints:**

| Step | Endpoint | Method | Purpose |
|------|----------|--------|---------|
| 1 | `/api/documents/presign` | POST | Get upload URL |
| 2 | `{presignedUrl}` | PUT | Upload file |
| 3 | `/api/units/:id/documents` | POST | Save metadata |

### **Request Formats:**

**Step 1:**
```json
{ "fileName": "...", "mimeType": "application/pdf", "sizeBytes": 123456 }
```

**Step 2:**
```
Binary file data (Content-Type: application/pdf)
```

**Step 3:**
```json
{ "title": "...", "category": "CONTRACT|BILL|OTHER", "fileKey": "...", "mimeType": "application/pdf", "sizeBytes": 123456 }
```

---

## ✅ Checklist for Frontend Integration

- [ ] File input accepts only `.pdf` files
- [ ] Client-side validation (type + size)
- [ ] Step 1: Get presigned URL
- [ ] Step 2: Upload to R2 with PUT
- [ ] Step 3: Create document record
- [ ] Error handling for each step
- [ ] Loading/progress indicators
- [ ] Success/error messages to user
- [ ] Refresh document list after upload

---

**Status:** ✅ Production Ready
**Endpoint:** `POST /api/documents/presign`
**Max File Size:** 10MB
**Allowed Type:** PDF only
**Expires:** 1 hour (presigned URL)
