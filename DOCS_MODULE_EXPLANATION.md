# Docs Module - Complete Explanation

## 📋 Overview

The **Docs Module** (`/src/modules/docs`) is a **centralized document generation and management system** for the Esnaad Dashboard. It handles automatic generation of professional PDF documents from templates and manages their storage in Cloudflare R2.

---

## 🎯 Purpose

The docs module serves as a **unified document generation engine** that can create PDFs for various parts of the system:

1. **Handover Agreements** - Legal documents for unit handovers
2. **Unit Profiles** - Property documentation (future)
3. **Snagging Reports** - Issue tracking documents (future)
4. **Project Reports** - Project summaries (future)

---

## 🏗️ Architecture

### Module Structure

```
src/modules/docs/
├── controllers/         # HTTP request handlers
│   └── document.controller.ts
├── dto/                # Data validation schemas
│   └── document.dto.ts
├── repositories/       # Database operations
│   └── document.repository.ts
├── routes/             # API endpoints
│   └── document.routes.ts
├── services/           # Business logic & PDF generation
│   └── document.service.ts
└── templates/          # Handlebars templates
    └── handover-agreement-v1.hbs
```

---

## 🔧 Core Components

### 1. Document Service (`document.service.ts`)

**Purpose:** The brain of the module - handles PDF generation and storage

**Key Capabilities:**

#### a) Template Processing
- Loads Handlebars (`.hbs`) templates
- Registers custom helpers for formatting
- Compiles templates with dynamic data

#### b) PDF Generation
- Uses **Puppeteer** (headless Chrome) to render HTML to PDF
- Generates professional A4 documents
- Supports custom margins and print backgrounds

#### c) File Management
- Calculates SHA-256 hash for file integrity
- Uploads PDFs to Cloudflare R2
- Creates database records for tracking

**Main Methods:**

```typescript
class DocumentService {
  // Generate handover PDF
  generateHandoverAgreement(handoverId, snapshot, user): Promise<Document>

  // Get document by ID
  getById(id): Promise<Document>

  // Get documents for specific module/entity
  getByModuleAndEntity(module, entityId): Promise<Document[]>

  // List documents with pagination
  list(filters): Promise<PaginatedDocuments>

  // Get all documents for a unit
  getByUnitId(unitId): Promise<Document[]>
}
```

---

### 2. Document Repository (`document.repository.ts`)

**Purpose:** Database layer for document CRUD operations

**Methods:**
- `create()` - Store document metadata in database
- `findById()` - Get document by ID
- `findByModuleAndEntity()` - Get documents for specific entity
- `findMany()` - List documents with filters and pagination

---

### 3. Document Controller (`document.controller.ts`)

**Purpose:** HTTP layer - handles API requests

**Endpoints:**
- `GET /documents/:id` - Get specific document
- `GET /documents` - List all documents (with filters)
- `GET /documents/module/:module/entity/:entityId` - Get documents for entity
- `GET /documents/unit/:unitId` - Get all documents for a unit

---

### 4. Templates Folder (`templates/`)

**Purpose:** Stores Handlebars templates for PDF generation

**Current Template:**
- `handover-agreement-v1.hbs` - Professional 3-page handover agreement

**Template Features:**
- Professional styling with CSS
- Dynamic data binding
- Conditional sections
- Custom Handlebars helpers
- Responsive tables
- Signature sections

---

## 📊 Database Schema

The module uses the `documents` table in PostgreSQL:

```typescript
model Document {
  id               String         @id @default(cuid())
  module           DocumentModule // HANDOVER, UNIT_PROFILE, SNAGGING, PROJECT
  entityId         String         // e.g., handoverId
  type             DocumentType   // PDF, DOCX, XLSX
  templateKey      String         // e.g., "handover-agreement-v1"
  version          Int            @default(1)

  // File details
  url              String         // Public R2 URL
  key              String         // R2 object key
  sha256Hash       String         // File integrity hash
  sizeBytes        Int            // File size

  // Metadata
  title            String?
  description      String?
  metadata         Json?

  createdByUserId  String
  createdAt        DateTime       @default(now())

  // Relations
  createdBy        User
  handover         Handover?      // Optional relation to handover
}
```

---

## 🔄 How It Works

### Complete PDF Generation Flow

```
1. TRIGGER
   ↓
   POST /api/handovers/:id/complete (Admin)

2. HANDOVER SERVICE
   ↓
   Creates snapshot of handover data

3. DOCUMENT SERVICE - generateHandoverAgreement()
   ↓
   ├─→ Load template: handover-agreement-v1.hbs
   ├─→ Register Handlebars helpers (formatDate, eq, etc.)
   ├─→ Compile template with snapshot data
   ├─→ Generate HTML
   │
4. PUPPETEER
   ↓
   ├─→ Launch headless Chrome
   ├─→ Render HTML to PDF
   ├─→ Apply A4 format + margins
   ├─→ Return PDF buffer
   │
5. HASH CALCULATION
   ↓
   Calculate SHA-256 hash of PDF

6. R2 UPLOAD (via UploadService)
   ↓
   ├─→ Upload PDF to Cloudflare R2
   ├─→ Get public URL
   │
7. DATABASE RECORD
   ↓
   ├─→ Create document record
   ├─→ Store: url, key, hash, size, metadata
   │
8. RETURN
   ↓
   Return Document object with PDF URL
```

---

## 🎨 Template System

### Handlebars Templates

The module uses **Handlebars** for templating because:
- ✅ Simple syntax
- ✅ Supports helpers and partials
- ✅ Conditionals and loops
- ✅ Clean separation of logic and presentation

### Custom Helpers Registered

```typescript
// Date formatting
{{formatDate date}}          // → "January 5, 2026"
{{formatDateTime datetime}}  // → "January 5, 2026, 10:30 AM"

// Comparisons
{{#if (eq status "OK")}}...{{/if}}
{{#if (ne value null)}}...{{/if}}
{{#if (gt count 0)}}...{{/if}}

// Logical
{{#if (and condition1 condition2)}}...{{/if}}
{{#if (or condition1 condition2)}}...{{/if}}
{{#if (not condition)}}...{{/if}}

// Debugging
{{json object}}  // Pretty-print JSON
```

### Template Data Structure

```typescript
{
  handover: {
    id: string;
    status: string;
    scheduledAt: Date;
    handoverAt: Date;
    notes: string;
    createdAt: Date;
  },
  unit: {
    unitNumber: string;
    buildingName: string;
    floor: number;
    area: number;
    bedrooms: number;
    bathrooms: number;
    unitType: string;
    address: string;
    project: { name, location };
  },
  owner: {
    name: string;
    email: string;
    phone: string;
    nationalId: string;
    address: string;
  },
  admin: {
    name: string;
    email: string;
  },
  items: [
    {
      category: string;
      label: string;
      expectedValue: string;
      actualValue: string;
      status: 'OK' | 'NOT_OK' | 'NA';
      notes: string;
      sortOrder: number;
    }
  ],
  attachments: [...],
  generatedAt: Date,
  generatedBy: { name, email }
}
```

---

## 🔐 Security & Integrity

### File Integrity

Every PDF has a **SHA-256 hash** calculated:
- Stored in database
- Can verify file hasn't been tampered with
- Useful for legal/compliance purposes

### Access Control

Documents inherit permissions from their parent entity:
- Handover documents → Owner can view their handovers
- Admin documents → Admin only
- Enforced at API level via auth middleware

### Storage Security

- Files stored in **Cloudflare R2** (S3-compatible)
- Public URLs for easy access
- Versioned storage (can extend for history)

---

## 📈 Supported Document Types

### Current: Handover Agreements ✅

**Module:** `HANDOVER`
**Type:** `PDF`
**Template:** `handover-agreement-v1.hbs`
**Size:** ~230 KB
**Pages:** 3
**Generated:** On handover completion

**Contents:**
- Header with document ID
- Unit information
- Owner information
- Handover details
- Complete inspection checklist
- Item statuses and notes
- Signature sections
- Footer with hash and generation info

### Future: Unit Profiles (Planned)

**Module:** `UNIT_PROFILE`
**Type:** `PDF` / `DOCX`
**Purpose:** Comprehensive unit documentation

**Potential Contents:**
- Unit specifications
- Floor plans
- Amenities list
- History of handovers
- Maintenance records
- Owner information

### Future: Snagging Reports (Planned)

**Module:** `SNAGGING`
**Type:** `PDF`
**Purpose:** Issue tracking documentation

**Potential Contents:**
- List of issues/defects
- Photos of problems
- Status tracking
- Resolution timeline
- Sign-off documentation

### Future: Project Reports (Planned)

**Module:** `PROJECT`
**Type:** `PDF` / `XLSX`
**Purpose:** Project summaries and analytics

**Potential Contents:**
- Project overview
- Units status
- Handover completion rates
- Financial summaries
- Timeline tracking

---

## 🚀 Usage Examples

### 1. Generate Handover PDF (Internal)

```typescript
// Called by HandoverService.complete()
const snapshot = await handoverRepo.createSnapshot(handoverId);

const document = await documentService.generateHandoverAgreement(
  handoverId,
  snapshot,
  adminUser
);

// Returns:
{
  id: "doc-id",
  url: "https://pub-xxx.r2.dev/handovers/.../agreement.pdf",
  key: "handovers/.../agreement.pdf",
  type: "PDF",
  module: "HANDOVER",
  entityId: handoverId,
  sha256Hash: "abc123...",
  sizeBytes: 237492
}
```

### 2. Get Documents for Unit (Frontend)

```typescript
// API call
GET /api/documents/unit/:unitId

// Returns all handover PDFs for this unit
[
  {
    id: "doc-1",
    url: "https://pub-xxx.r2.dev/handovers/.../agreement-1.pdf",
    title: "Handover Agreement",
    createdAt: "2026-01-05T10:00:00Z",
    handover: {
      status: "COMPLETED",
      completedAt: "2026-01-05T10:00:00Z"
    }
  }
]
```

### 3. Retrieve Specific Document

```typescript
// API call
GET /api/documents/:documentId

// Returns full document details
{
  id: "doc-id",
  module: "HANDOVER",
  type: "PDF",
  url: "https://pub-xxx.r2.dev/...",
  sizeBytes: 237492,
  sha256Hash: "...",
  createdBy: {
    name: "Admin User",
    email: "admin@example.com"
  },
  createdAt: "2026-01-05T10:00:00Z"
}
```

---

## 🛠️ Extending the Module

### Adding a New Document Type

**Example: Unit Profile PDF**

#### 1. Create Template

Create `templates/unit-profile-v1.hbs`:

```handlebars
<!DOCTYPE html>
<html>
<head>
  <title>Unit Profile - {{unit.unitNumber}}</title>
  <style>/* Your CSS */</style>
</head>
<body>
  <h1>Unit Profile: {{unit.unitNumber}}</h1>
  <!-- Your content -->
</body>
</html>
```

#### 2. Add Service Method

In `document.service.ts`:

```typescript
async generateUnitProfile(unitId: string, user: User): Promise<Document> {
  this.registerHelpers();

  // Load template
  const templatePath = path.join(__dirname, '../templates/unit-profile-v1.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);

  // Fetch unit data
  const unit = await this.prisma.unit.findUnique({
    where: { id: unitId },
    include: { owner: true, project: true, handovers: true }
  });

  // Prepare data
  const data = {
    unit,
    generatedAt: new Date(),
    generatedBy: user
  };

  // Generate HTML
  const html = template(data);

  // Generate PDF
  const pdfBuffer = await this.generatePDF(html);

  // Calculate hash
  const hash = this.calculateHash(pdfBuffer);

  // Upload to R2
  const fileName = `unit-profiles/${unitId}/profile-${Date.now()}.pdf`;
  const uploadResult = await this.uploadService.uploadToR2(
    pdfBuffer,
    fileName,
    'application/pdf'
  );

  // Create document record
  return await this.documentRepo.create({
    module: 'UNIT_PROFILE',
    entityId: unitId,
    type: 'PDF',
    templateKey: 'unit-profile-v1',
    version: 1,
    url: uploadResult.url,
    key: uploadResult.key,
    sha256Hash: hash,
    sizeBytes: pdfBuffer.length,
    title: `Unit Profile - ${unit.unitNumber}`,
    createdByUserId: user.id
  });
}
```

#### 3. Add Endpoint

In routes or relevant module:

```typescript
router.get('/units/:id/profile/generate', async (req, res) => {
  const document = await documentService.generateUnitProfile(
    req.params.id,
    req.user
  );
  res.json({ success: true, data: document });
});
```

---

## 📊 Performance Considerations

### PDF Generation Time

- **Small documents (1-2 pages):** 2-4 seconds
- **Medium documents (3-5 pages):** 5-8 seconds
- **Large documents (10+ pages):** 10-15 seconds

**Why?** Puppeteer launches headless Chrome - takes time

### Optimization Strategies

1. **Async Generation**
   - Generate PDFs in background jobs
   - Return immediately, notify when done

2. **Template Caching**
   - Cache compiled templates
   - Reduce I/O operations

3. **Browser Pooling**
   - Reuse Puppeteer instances
   - Reduce startup overhead

4. **CDN Caching**
   - Use Cloudflare CDN for R2
   - Cache PDFs at edge

---

## 🔍 Monitoring & Debugging

### Logs to Watch

```typescript
// PDF generation started
console.log('Generating PDF for handover:', handoverId);

// Template loaded
console.log('Template loaded:', templatePath);

// Puppeteer operations
console.log('Launching browser...');
console.log('PDF generated, size:', pdfBuffer.length);

// Upload to R2
console.log('Uploading to R2:', fileName);
console.log('Upload complete, URL:', uploadResult.url);

// Database record
console.log('Document created:', document.id);
```

### Common Issues

**1. Puppeteer Launch Fails**
- Missing Chrome dependencies
- Solution: Install system libraries
```bash
apt-get install -y chromium-browser
```

**2. Template Not Found**
- Incorrect path in production
- Solution: Use `__dirname` for absolute paths

**3. R2 Upload Fails**
- Wrong credentials
- Solution: Verify R2_* environment variables

**4. PDF Renders Incorrectly**
- CSS not loaded
- Solution: Use inline styles or `waitUntil: 'networkidle0'`

---

## 🎯 Benefits of This Design

### 1. **Centralized**
All document generation in one place - easy to maintain

### 2. **Reusable**
Same service can generate documents for any module

### 3. **Scalable**
Easy to add new document types without duplicating code

### 4. **Testable**
Each component (service, template, upload) can be tested independently

### 5. **Traceable**
Every document has:
- Unique ID
- Generation timestamp
- Creator information
- File integrity hash
- Storage location

### 6. **Flexible**
Support multiple formats: PDF, DOCX, XLSX

### 7. **Professional**
High-quality PDFs with custom styling

---

## 📚 Summary

The **Docs Module** is a **powerful document generation engine** that:

✅ Generates professional PDFs from Handlebars templates
✅ Uses Puppeteer for HTML-to-PDF conversion
✅ Uploads to Cloudflare R2 for storage
✅ Tracks all documents in database
✅ Provides public URLs for easy access
✅ Ensures file integrity with SHA-256 hashes
✅ Supports multiple document types and modules
✅ Ready for future expansion

**Current Use Case:** Handover Agreement PDFs
**Future Potential:** Unit profiles, snagging reports, project summaries, financial reports, and more!

---

**Location:** `/src/modules/docs`
**Status:** ✅ Production Ready
**Dependencies:** Puppeteer, Handlebars, Cloudflare R2
