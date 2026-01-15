# Handover System - Frontend Integration Guide

## Overview

Complete guide for integrating the handover workflow with automatic PDF generation and R2 storage into the frontend application.

---

## Table of Contents

1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
3. [Workflow Steps](#workflow-steps)
4. [Data Types](#data-types)
5. [Code Examples](#code-examples)
6. [Error Handling](#error-handling)
7. [Testing](#testing)

---

## Authentication

All endpoints require JWT authentication via Bearer token in the Authorization header.

```typescript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
}
```

---

## API Endpoints

### Base URL
- **Development**: `http://localhost:8080/api`
- **Production**: `https://your-api-domain.com/api`

### Handover Endpoints

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/handovers` | POST | ADMIN | Create new handover |
| `/handovers` | GET | ADMIN/OWNER | List handovers |
| `/handovers/:id` | GET | ADMIN/OWNER | Get handover details |
| `/handovers/:id` | PATCH | ADMIN | Update handover |
| `/handovers/:id/items` | POST | ADMIN | Add/update checklist items |
| `/handovers/:id/send` | POST | ADMIN | Send to owner |
| `/handovers/:id/owner-confirm` | POST | OWNER | Owner confirmation |
| `/handovers/:id/request-changes` | POST | OWNER | Request changes |
| `/handovers/:id/admin-confirm` | POST | ADMIN | Admin confirmation |
| `/handovers/:id/complete` | POST | ADMIN | Complete & generate PDF |
| `/handovers/:id/cancel` | POST | ADMIN | Cancel handover |
| `/handovers/:id/messages` | GET | ADMIN/OWNER | Get messages |
| `/handovers/:id/messages` | POST | ADMIN/OWNER | Add message |

### Document Endpoints

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/documents/unit/:unitId` | GET | ADMIN/OWNER | Get all PDFs for unit |
| `/documents/:id` | GET | ADMIN/OWNER | Get document details |
| `/documents` | GET | ADMIN | List all documents |

---

## Workflow Steps

### Complete Handover Cycle

```
DRAFT → SENT_TO_OWNER → OWNER_CONFIRMED → ADMIN_CONFIRMED → COMPLETED
```

#### State Diagram

```
┌──────────┐
│  DRAFT   │ ──────────────────────────────────┐
└──────────┘                                    │
     │                                          │
     │ admin/send                               │ admin/cancel
     ↓                                          ↓
┌─────────────────┐                      ┌───────────┐
│ SENT_TO_OWNER  │ ─────────────────────→│ CANCELLED │
└─────────────────┘                      └───────────┘
     │        │
     │        │ owner/request-changes
     │        ↓
     │   ┌────────────────────┐
     │   │ CHANGES_REQUESTED │
     │   └────────────────────┘
     │             │
     │             │ admin/send (back to SENT_TO_OWNER)
     │             │
     │ owner/owner-confirm
     ↓
┌──────────────────┐
│ OWNER_CONFIRMED │
└──────────────────┘
     │
     │ admin/admin-confirm
     ↓
┌──────────────────┐
│ ADMIN_CONFIRMED │
└──────────────────┘
     │
     │ admin/complete (generates PDF)
     ↓
┌───────────┐
│ COMPLETED │
└───────────┘
```

---

## Data Types

### Handover Object

```typescript
interface Handover {
  id: string;
  unitId: string;
  ownerId: string;
  createdByAdminId: string;
  status: HandoverStatus;
  version: number;

  // Dates
  scheduledAt: string | null;
  handoverAt: string | null;
  ownerConfirmedAt: string | null;
  adminConfirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;

  // Content
  notes: string | null;
  internalNotes: string | null;

  // Relations
  unit: UnitSummary;
  owner: UserSummary;
  createdByAdmin: UserSummary;
  items: HandoverItem[];
  attachments: HandoverAttachment[];
  messages?: HandoverMessage[];
  documents?: Document[];

  // Counts
  _count?: {
    messages: number;
    documents: number;
  };

  createdAt: string;
  updatedAt: string;
}

type HandoverStatus =
  | 'DRAFT'
  | 'SENT_TO_OWNER'
  | 'OWNER_CONFIRMED'
  | 'CHANGES_REQUESTED'
  | 'ADMIN_CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED';
```

### Handover Item

```typescript
interface HandoverItem {
  id: string;
  handoverId: string;
  category: string;           // e.g., "Electrical", "Plumbing"
  label: string;              // e.g., "All lights working"
  expectedValue?: string;     // Optional expected value
  actualValue?: string;       // Actual observed value (set by owner)
  status: HandoverItemStatus; // OK, NOT_OK, NA
  notes?: string;             // Additional notes
  sortOrder: number;          // Display order
  attachments?: HandoverAttachment[];
  createdAt: string;
  updatedAt: string;
}

type HandoverItemStatus = 'OK' | 'NOT_OK' | 'NA';
```

### Document Object

```typescript
interface Document {
  id: string;
  module: 'HANDOVER' | 'UNIT_PROFILE' | 'SNAGGING' | 'PROJECT';
  entityId: string;           // Handover ID
  type: 'PDF' | 'DOCX' | 'XLSX';
  templateKey: string;        // e.g., "handover-agreement-v1"
  version: number;

  // File details
  url: string;                // Public R2 URL
  key: string;                // R2 object key
  sha256Hash: string;         // File integrity hash
  sizeBytes: number;

  // Metadata
  title?: string;
  description?: string;
  metadata?: any;

  createdByUserId: string;
  createdBy?: UserSummary;
  createdAt: string;
}
```

---

## Code Examples

### 1. Create Handover (Admin)

```typescript
async function createHandover(data: {
  unitId: string;
  ownerId: string;
  scheduledAt?: string;
  notes?: string;
  items?: Array<{
    category: string;
    label: string;
    status?: 'OK' | 'NOT_OK' | 'NA';
    expectedValue?: string;
    sortOrder?: number;
  }>;
}) {
  const response = await fetch('/api/handovers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create handover');
  }

  const result = await response.json();
  return result.data; // Handover object with items
}

// Example usage
const handover = await createHandover({
  unitId: 'cmjx6o6tv000118cfo6dfj64z',
  ownerId: 'cmjx5qb8z000518o4uo6x2y8k',
  scheduledAt: '2026-01-15T10:00:00Z',
  notes: 'Initial handover inspection',
  items: [
    {
      category: 'Electrical',
      label: 'All lights working',
      status: 'NA',
      sortOrder: 1
    },
    {
      category: 'Plumbing',
      label: 'No leaks in bathroom',
      status: 'NA',
      sortOrder: 2
    }
  ]
});

console.log('Handover created:', handover.id);
console.log('Items created:', handover.items.length);
```

### 2. Add/Update Items to Existing Handover (Admin)

```typescript
async function updateHandoverItems(
  handoverId: string,
  items: Array<{
    id?: string; // Optional - omit for new items
    category: string;
    label: string;
    status?: 'OK' | 'NOT_OK' | 'NA';
    expectedValue?: string;
    actualValue?: string;
    notes?: string;
    sortOrder?: number;
  }>
) {
  const response = await fetch(`/api/handovers/${handoverId}/items`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ items })
  });

  if (!response.ok) throw new Error('Failed to update items');

  const result = await response.json();
  return result.data; // Updated handover with items
}

// Example: Add new items
await updateHandoverItems(handover.id, [
  {
    category: 'HVAC',
    label: 'Air conditioning working',
    status: 'NA',
    sortOrder: 3
  },
  {
    category: 'Doors & Windows',
    label: 'All doors close properly',
    status: 'NA',
    sortOrder: 4
  }
]);
```

### 3. Send Handover to Owner (Admin)

```typescript
async function sendHandoverToOwner(
  handoverId: string,
  message?: string
) {
  const response = await fetch(`/api/handovers/${handoverId}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message })
  });

  if (!response.ok) throw new Error('Failed to send handover');

  const result = await response.json();
  return result.data; // Status now: SENT_TO_OWNER
}

// Example
await sendHandoverToOwner(
  handover.id,
  'Please review the checklist items and confirm'
);
```

### 4. Owner Views Handover

```typescript
async function getHandover(handoverId: string) {
  const response = await fetch(`/api/handovers/${handoverId}`, {
    headers: {
      'Authorization': `Bearer ${ownerToken}`
    }
  });

  if (!response.ok) throw new Error('Failed to get handover');

  const result = await response.json();
  return result.data; // Full handover with items
}

// Example: Display to owner
const handover = await getHandover(handoverId);

console.log('Unit:', handover.unit.unitNumber);
console.log('Status:', handover.status);
console.log('Items to check:', handover.items.length);

// Render checklist
handover.items.forEach(item => {
  console.log(`${item.category} - ${item.label}: ${item.status}`);
});
```

### 5. Owner Confirms Handover with Item Updates

```typescript
async function confirmHandover(
  handoverId: string,
  acknowledgement: string,
  itemUpdates: Array<{
    id: string;
    status: 'OK' | 'NOT_OK' | 'NA';
    actualValue?: string;
    notes?: string;
  }>
) {
  const response = await fetch(`/api/handovers/${handoverId}/owner-confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ownerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      acknowledgement,
      itemUpdates
    })
  });

  if (!response.ok) throw new Error('Failed to confirm handover');

  const result = await response.json();
  return result.data; // Status now: OWNER_CONFIRMED
}

// Example: Owner updates checklist and confirms
await confirmHandover(
  handover.id,
  'I have inspected the unit and confirm the handover',
  [
    {
      id: handover.items[0].id,
      status: 'OK',
      actualValue: 'All lights tested and working',
      notes: 'Tested all rooms'
    },
    {
      id: handover.items[1].id,
      status: 'NOT_OK',
      notes: 'Small leak under kitchen sink - needs fixing'
    },
    {
      id: handover.items[2].id,
      status: 'OK'
    }
  ]
);
```

### 6. Owner Requests Changes

```typescript
async function requestChanges(
  handoverId: string,
  message: string
) {
  const response = await fetch(`/api/handovers/${handoverId}/request-changes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ownerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message })
  });

  if (!response.ok) throw new Error('Failed to request changes');

  const result = await response.json();
  return result.data; // Status now: CHANGES_REQUESTED
}

// Example
await requestChanges(
  handover.id,
  'Please fix the kitchen sink leak before final handover'
);
```

### 7. Admin Final Confirmation

```typescript
async function adminConfirm(
  handoverId: string,
  finalNotes?: string
) {
  const response = await fetch(`/api/handovers/${handoverId}/admin-confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ finalNotes })
  });

  if (!response.ok) throw new Error('Failed to confirm');

  const result = await response.json();
  return result.data; // Status now: ADMIN_CONFIRMED
}

// Example
await adminConfirm(
  handover.id,
  'All items reviewed. Kitchen sink repaired. Ready for completion.'
);
```

### 8. Complete Handover & Generate PDF

```typescript
async function completeHandover(handoverId: string) {
  const response = await fetch(`/api/handovers/${handoverId}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  if (!response.ok) throw new Error('Failed to complete handover');

  const result = await response.json();
  return result.data; // Includes document with PDF URL
}

// Example
const completed = await completeHandover(handover.id);

console.log('Status:', completed.status); // COMPLETED
console.log('PDF URL:', completed.document.url);
console.log('PDF Size:', completed.document.sizeBytes, 'bytes');

// Open PDF in new tab
window.open(completed.document.url, '_blank');

// Or download PDF
const link = document.createElement('a');
link.href = completed.document.url;
link.download = `handover-${handover.unit.unitNumber}.pdf`;
link.click();
```

### 9. Get All Documents for Unit (Unit Profile Page)

```typescript
async function getUnitDocuments(unitId: string) {
  const response = await fetch(`/api/documents/unit/${unitId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) throw new Error('Failed to get documents');

  const result = await response.json();
  return result.data; // Array of Document objects
}

// Example: Display all handover PDFs for a unit
const documents = await getUnitDocuments(unit.id);

documents.forEach(doc => {
  console.log('PDF:', doc.title);
  console.log('Date:', new Date(doc.createdAt).toLocaleDateString());
  console.log('URL:', doc.url);
  console.log('Status:', doc.handover?.status);
  console.log('---');
});
```

### 10. List Handovers with Filters

```typescript
async function listHandovers(filters: {
  status?: HandoverStatus;
  unitId?: string;
  ownerId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'handoverAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) params.append(key, String(value));
  });

  const response = await fetch(`/api/handovers?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) throw new Error('Failed to list handovers');

  const result = await response.json();
  return {
    data: result.data,
    meta: result.meta // pagination info
  };
}

// Example: Get pending handovers for a unit
const { data, meta } = await listHandovers({
  unitId: unit.id,
  status: 'SENT_TO_OWNER',
  page: 1,
  limit: 10
});

console.log('Found:', meta.total, 'handovers');
console.log('Pages:', meta.totalPages);
```

---

## Error Handling

### Standard Error Response

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  errors?: Array<{
    path: string;
    message: string;
  }>;
  stack?: string; // Only in development
}
```

### Common HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Validation error, invalid data |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Handover/item not found |
| 409 | Conflict | Invalid state transition |
| 500 | Server Error | Internal server error |

### Error Handling Example

```typescript
async function handleHandoverAction<T>(
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Response) {
      const errorData = await error.json();

      switch (error.status) {
        case 400:
          throw new Error(`Validation error: ${errorData.error}`);
        case 401:
          // Redirect to login
          window.location.href = '/login';
          break;
        case 403:
          throw new Error('You do not have permission for this action');
        case 404:
          throw new Error('Handover not found');
        case 409:
          throw new Error(`Invalid action: ${errorData.error}`);
        default:
          throw new Error('An unexpected error occurred');
      }
    }
    throw error;
  }
}

// Usage
try {
  const handover = await handleHandoverAction(() =>
    completeHandover(handoverId)
  );
  console.log('Success!', handover);
} catch (error) {
  console.error('Error:', error.message);
  // Show error to user
}
```

---

## React/Next.js Integration Examples

### Custom Hook: useHandover

```typescript
import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) =>
  fetch(url, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  }).then(r => r.json()).then(d => d.data);

export function useHandover(handoverId: string) {
  const { data, error, mutate } = useSWR(
    `/api/handovers/${handoverId}`,
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10s
  );

  return {
    handover: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate
  };
}

// Usage in component
function HandoverDetail({ handoverId }: { handoverId: string }) {
  const { handover, isLoading, refresh } = useHandover(handoverId);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>{handover.unit.unitNumber}</h1>
      <p>Status: {handover.status}</p>
      <ul>
        {handover.items.map(item => (
          <li key={item.id}>
            {item.label} - {item.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Owner Confirmation Form

```typescript
import { useState } from 'react';
import { useForm } from 'react-hook-form';

interface ItemUpdate {
  id: string;
  status: 'OK' | 'NOT_OK' | 'NA';
  actualValue?: string;
  notes?: string;
}

function OwnerConfirmForm({ handover }: { handover: Handover }) {
  const [itemUpdates, setItemUpdates] = useState<Map<string, ItemUpdate>>(
    new Map()
  );
  const { register, handleSubmit } = useForm();

  const updateItem = (itemId: string, update: Partial<ItemUpdate>) => {
    setItemUpdates(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, {
        id: itemId,
        status: 'NA',
        ...prev.get(itemId),
        ...update
      });
      return newMap;
    });
  };

  const onSubmit = async (data: { acknowledgement: string }) => {
    try {
      await confirmHandover(
        handover.id,
        data.acknowledgement,
        Array.from(itemUpdates.values())
      );
      alert('Handover confirmed!');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2>Inspection Checklist</h2>

      {handover.items.map(item => (
        <div key={item.id} className="item">
          <h3>{item.category}</h3>
          <p>{item.label}</p>

          <select
            onChange={e => updateItem(item.id, {
              status: e.target.value as ItemUpdate['status']
            })}
          >
            <option value="NA">Not Applicable</option>
            <option value="OK">OK</option>
            <option value="NOT_OK">Not OK</option>
          </select>

          <input
            type="text"
            placeholder="Actual value"
            onChange={e => updateItem(item.id, {
              actualValue: e.target.value
            })}
          />

          <textarea
            placeholder="Notes"
            onChange={e => updateItem(item.id, {
              notes: e.target.value
            })}
          />
        </div>
      ))}

      <div>
        <label>Final Acknowledgement</label>
        <textarea
          {...register('acknowledgement', { required: true })}
          placeholder="I confirm that I have inspected the unit..."
        />
      </div>

      <button type="submit">Confirm Handover</button>
    </form>
  );
}
```

### PDF Viewer Component

```typescript
function PDFViewer({ documentUrl }: { documentUrl: string }) {
  const [loading, setLoading] = useState(false);

  const downloadPDF = async () => {
    setLoading(true);
    try {
      const response = await fetch(documentUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'handover-agreement.pdf';
      link.click();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <iframe
        src={documentUrl}
        width="100%"
        height="600px"
        title="Handover Agreement PDF"
      />

      <div className="actions">
        <button onClick={() => window.open(documentUrl, '_blank')}>
          Open in New Tab
        </button>

        <button onClick={downloadPDF} disabled={loading}>
          {loading ? 'Downloading...' : 'Download PDF'}
        </button>
      </div>
    </div>
  );
}
```

---

## Testing

### Test Credentials

After running seed script:

```
Admin:
  Email: admin@example.com
  Password: Admin123!

Owner 1:
  Email: owner1@example.com
  Password: Owner123!

Owner 2:
  Email: owner2@example.com
  Password: Owner123!
```

### Automated Test Script

A complete test script is available at:
```
/path/to/backend/test-handover-cycle.sh
```

Run it to verify the complete workflow:
```bash
./test-handover-cycle.sh
```

### Manual Testing Checklist

- [ ] Admin can create handover with items
- [ ] Admin can add items to existing handover
- [ ] Admin can send handover to owner
- [ ] Owner receives notification (if implemented)
- [ ] Owner can view handover and all items
- [ ] Owner can update item statuses
- [ ] Owner can confirm handover
- [ ] Owner can request changes
- [ ] Admin can review owner updates
- [ ] Admin can perform final confirmation
- [ ] Admin can complete handover
- [ ] PDF is generated automatically
- [ ] PDF is uploaded to R2
- [ ] PDF URL is publicly accessible
- [ ] PDF can be downloaded
- [ ] PDF contains all handover details
- [ ] Documents appear in unit profile
- [ ] Audit logs are created for all actions

---

## Environment Variables

### Required in Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

### Backend (Already Configured)

```env
# R2 Storage
R2_ACCOUNT_ID=0ec39f45b1d00cce5d81d8852dc2c80a
R2_ACCESS_KEY_ID=748a91a0100bd4c23e730ade221d0ac2
R2_SECRET_ACCESS_KEY=***
R2_BUCKET=esnaad-dashbaord
R2_PUBLIC_URL=https://pub-a506bda297e04d6e9a938023d2f29fdc.r2.dev
```

---

## Production Checklist

Before deploying to production:

- [ ] Update `NEXT_PUBLIC_API_URL` to production API URL
- [ ] Verify R2 bucket is properly configured
- [ ] Test PDF generation in production
- [ ] Verify PDF URLs are accessible
- [ ] Configure email notifications (optional)
- [ ] Set up monitoring for PDF generation
- [ ] Test with real user data
- [ ] Verify role-based permissions
- [ ] Check PDF template styling
- [ ] Test on mobile devices
- [ ] Verify download functionality across browsers

---

## Support & Troubleshooting

### Common Issues

**1. PDF Not Generating**
- Check Puppeteer is installed: `npm list puppeteer`
- Verify handover status is `ADMIN_CONFIRMED`
- Check server logs for errors

**2. PDF URL Returns 404**
- Verify R2_PUBLIC_URL is correct
- Check R2 bucket permissions
- Ensure file was uploaded successfully

**3. Owner Cannot Update Items**
- Verify handover status is `SENT_TO_OWNER`
- Check owner is assigned to this handover
- Verify item IDs are correct

**4. State Transition Error**
- Check current status
- Verify allowed transitions in state diagram
- Ensure user has correct role

### Debug Mode

Enable detailed logging in development:

```typescript
const DEBUG = process.env.NODE_ENV === 'development';

async function apiCall(endpoint: string, options: RequestInit) {
  if (DEBUG) {
    console.log('API Call:', endpoint, options);
  }

  const response = await fetch(endpoint, options);

  if (DEBUG) {
    const clone = response.clone();
    const data = await clone.json();
    console.log('API Response:', data);
  }

  return response;
}
```

---

## Additional Resources

- **API Documentation**: Check Swagger/OpenAPI docs (if available)
- **Test Script**: `test-handover-cycle.sh`
- **Prisma Schema**: `prisma/schema.prisma`
- **PDF Template**: `src/modules/docs/templates/handover-agreement-v1.hbs`

---

## Contact

For questions or issues with the handover system integration:
- Backend Team: [contact info]
- System Architecture: Check `CLAUDE.md` in backend repo

---

**Last Updated**: January 2026
**API Version**: 1.0
**Status**: ✅ Production Ready
