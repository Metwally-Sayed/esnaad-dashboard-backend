# Handover System - Quick Reference

## 🚀 Quick Start

### Complete Workflow in 8 Steps

```typescript
// 1. ADMIN: Create handover
const handover = await fetch('/api/handovers', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    unitId: 'unit-id',
    ownerId: 'owner-id',
    items: [{ category: 'Electrical', label: 'Lights working', status: 'NA', sortOrder: 1 }]
  })
}).then(r => r.json()).then(d => d.data);

// 2. ADMIN: Add more items (optional)
await fetch(`/api/handovers/${handover.id}/items`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: [/* more items */] })
});

// 3. ADMIN: Send to owner
await fetch(`/api/handovers/${handover.id}/send`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Please review' })
});

// 4. OWNER: View handover
const viewHandover = await fetch(`/api/handovers/${handover.id}`, {
  headers: { 'Authorization': `Bearer ${ownerToken}` }
}).then(r => r.json()).then(d => d.data);

// 5. OWNER: Confirm with updates
await fetch(`/api/handovers/${handover.id}/owner-confirm`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    acknowledgement: 'I confirm',
    itemUpdates: [
      { id: viewHandover.items[0].id, status: 'OK', notes: 'Tested' }
    ]
  })
});

// 6. ADMIN: Final confirmation
await fetch(`/api/handovers/${handover.id}/admin-confirm`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ finalNotes: 'All good' })
});

// 7. ADMIN: Complete & generate PDF
const completed = await fetch(`/api/handovers/${handover.id}/complete`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${adminToken}` }
}).then(r => r.json()).then(d => d.data);

// 8. Get PDF URL
const pdfUrl = completed.document.url;
window.open(pdfUrl, '_blank'); // ✅ PDF opens!
```

---

## 📋 API Endpoints Cheat Sheet

### Handovers

| Action | Endpoint | Method | Role | Body |
|--------|----------|--------|------|------|
| Create | `/handovers` | POST | ADMIN | `{ unitId, ownerId, items? }` |
| List | `/handovers` | GET | BOTH | Query params |
| Get | `/handovers/:id` | GET | BOTH | - |
| Update | `/handovers/:id` | PATCH | ADMIN | `{ notes?, scheduledAt? }` |
| Add Items | `/handovers/:id/items` | POST | ADMIN | `{ items: [...] }` |
| Send | `/handovers/:id/send` | POST | ADMIN | `{ message? }` |
| Owner Confirm | `/handovers/:id/owner-confirm` | POST | OWNER | `{ acknowledgement?, itemUpdates? }` |
| Request Changes | `/handovers/:id/request-changes` | POST | OWNER | `{ message }` |
| Admin Confirm | `/handovers/:id/admin-confirm` | POST | ADMIN | `{ finalNotes? }` |
| **Complete (PDF)** | `/handovers/:id/complete` | POST | ADMIN | - |
| Cancel | `/handovers/:id/cancel` | POST | ADMIN | `{ reason }` |

### Documents

| Action | Endpoint | Method | Returns |
|--------|----------|--------|---------|
| Get for Unit | `/documents/unit/:unitId` | GET | All PDFs for unit |
| Get by ID | `/documents/:id` | GET | Single document |

---

## 🔄 Status Flow

```
DRAFT ──send──> SENT_TO_OWNER ──owner-confirm──> OWNER_CONFIRMED
                      │                                   │
                      │                                   │
                request-changes              admin-confirm
                      │                                   │
                      ↓                                   ↓
             CHANGES_REQUESTED              ADMIN_CONFIRMED ──complete──> COMPLETED
                                                                               │
                                                                               ↓
                                                                         ✅ PDF GENERATED
```

---

## 💾 TypeScript Types

```typescript
type HandoverStatus = 'DRAFT' | 'SENT_TO_OWNER' | 'OWNER_CONFIRMED' | 'CHANGES_REQUESTED' | 'ADMIN_CONFIRMED' | 'COMPLETED' | 'CANCELLED';
type HandoverItemStatus = 'OK' | 'NOT_OK' | 'NA';

interface Handover {
  id: string;
  status: HandoverStatus;
  unit: { id: string; unitNumber: string };
  owner: { id: string; name: string; email: string };
  items: HandoverItem[];
  document?: Document;
}

interface HandoverItem {
  id: string;
  category: string;
  label: string;
  status: HandoverItemStatus;
  actualValue?: string;
  notes?: string;
  sortOrder: number;
}

interface Document {
  id: string;
  url: string;          // ← PDF URL
  type: 'PDF';
  sizeBytes: number;
  createdAt: string;
}
```

---

## 🎯 Common Use Cases

### 1. Display Checklist to Owner

```typescript
const { data: handover } = await fetch(`/api/handovers/${id}`, {
  headers: { Authorization: `Bearer ${ownerToken}` }
}).then(r => r.json());

// Group items by category
const grouped = handover.items.reduce((acc, item) => {
  if (!acc[item.category]) acc[item.category] = [];
  acc[item.category].push(item);
  return acc;
}, {});

// Render
Object.entries(grouped).map(([category, items]) => (
  <div key={category}>
    <h3>{category}</h3>
    {items.map(item => (
      <ChecklistItem key={item.id} item={item} />
    ))}
  </div>
));
```

### 2. Show Unit's Handover History

```typescript
const { data: documents } = await fetch(`/api/documents/unit/${unitId}`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

documents.map(doc => (
  <div key={doc.id}>
    <h4>{new Date(doc.createdAt).toLocaleDateString()}</h4>
    <p>Status: {doc.handover.status}</p>
    <a href={doc.url} target="_blank">View PDF</a>
  </div>
));
```

### 3. Download PDF

```typescript
async function downloadPDF(url: string, filename: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Usage
downloadPDF(
  handover.document.url,
  `handover-${handover.unit.unitNumber}.pdf`
);
```

---

## ⚠️ Important Notes

### ✅ DO

- Always check handover status before actions
- Validate item IDs exist before updating
- Handle state transition errors gracefully
- Show loading state during PDF generation (5-10s)
- Cache handover data with SWR or React Query

### ❌ DON'T

- Don't allow state transitions that aren't allowed
- Don't skip owner confirmation step
- Don't generate PDF before ADMIN_CONFIRMED status
- Don't hardcode item IDs
- Don't forget error handling

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid state transition" | Check current status, see flow diagram |
| "Handover not found" | Verify ID, check user permissions |
| PDF 404 | R2 URL format changed, check `document.url` |
| Items not showing | Call `/handovers/:id` not just list endpoint |
| Can't update items | Only ADMIN in DRAFT/editable states |

---

## 📱 Example: React Component

```typescript
function HandoverWorkflow({ handoverId }: { handoverId: string }) {
  const { data: handover, mutate } = useSWR(`/api/handovers/${handoverId}`);
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/handovers/${handoverId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const { data } = await response.json();

      // Success! Open PDF
      window.open(data.document.url, '_blank');

      mutate(); // Refresh data
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Status: {handover?.status}</h2>

      {handover?.status === 'ADMIN_CONFIRMED' && (
        <button onClick={handleComplete} disabled={loading}>
          {loading ? 'Generating PDF...' : 'Complete Handover'}
        </button>
      )}

      {handover?.document && (
        <a href={handover.document.url} target="_blank">
          📄 View PDF Agreement
        </a>
      )}
    </div>
  );
}
```

---

## 🔑 Test Credentials

```
Admin:      admin@example.com / Admin123!
Owner 1:    owner1@example.com / Owner123!
Owner 2:    owner2@example.com / Owner123!
```

---

## 📊 Response Format

All endpoints return:

```typescript
// Success
{
  "success": true,
  "data": { /* handover or document object */ }
}

// Error
{
  "success": false,
  "error": "Error message",
  "errors": [{ "path": "field", "message": "Invalid" }] // validation errors
}
```

---

## 🎨 PDF Contains

✅ Unit details (number, building, floor, area, etc.)
✅ Owner information (name, email, ID)
✅ Complete checklist with statuses
✅ Item notes and actual values
✅ Signature sections
✅ Generation timestamp
✅ Document hash

**Size:** ~230 KB
**Pages:** 3
**Format:** PDF 1.4

---

## 🚀 Production Ready

- ✅ PDF generation tested
- ✅ R2 upload working
- ✅ Public URLs accessible
- ✅ Complete workflow verified
- ✅ Error handling implemented
- ✅ Audit logging enabled
- ✅ Role-based permissions enforced

**Status:** Ready for frontend integration! 🎉
