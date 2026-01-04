# Handover Module API Examples

## Authentication
All requests require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## 1. Create Handover (Admin Only)

### Request
```http
POST /api/handovers
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "unitId": "clm1234567890abcdef",
  "ownerId": "clm0987654321fedcba",
  "scheduledAt": "2024-01-15T10:00:00Z",
  "handoverAt": "2024-01-15T14:00:00Z",
  "notes": "Unit is in excellent condition. All appliances checked and working.",
  "items": [
    {
      "category": "Electrical",
      "label": "All lights functioning",
      "expectedValue": "Working",
      "actualValue": "Working",
      "status": "OK",
      "sortOrder": 1
    },
    {
      "category": "Electrical",
      "label": "Power outlets tested",
      "expectedValue": "Working",
      "actualValue": "Working",
      "status": "OK",
      "sortOrder": 2
    },
    {
      "category": "Plumbing",
      "label": "Kitchen sink",
      "expectedValue": "No leaks",
      "actualValue": "No leaks",
      "status": "OK",
      "sortOrder": 3
    },
    {
      "category": "Plumbing",
      "label": "Bathroom fixtures",
      "expectedValue": "Working",
      "actualValue": "Minor drip in faucet",
      "status": "NOT_OK",
      "notes": "Maintenance scheduled",
      "sortOrder": 4
    },
    {
      "category": "General",
      "label": "Windows and doors",
      "expectedValue": "Secure",
      "actualValue": "Secure",
      "status": "OK",
      "sortOrder": 5
    },
    {
      "category": "General",
      "label": "Wall paint condition",
      "status": "OK",
      "notes": "Fresh paint, no damages",
      "sortOrder": 6
    },
    {
      "category": "Appliances",
      "label": "Air conditioning",
      "expectedValue": "Working",
      "actualValue": "Working",
      "status": "OK",
      "sortOrder": 7
    },
    {
      "category": "Meters",
      "label": "Electricity meter reading",
      "actualValue": "12345 kWh",
      "status": "OK",
      "sortOrder": 8
    },
    {
      "category": "Meters",
      "label": "Water meter reading",
      "actualValue": "678 m³",
      "status": "OK",
      "sortOrder": 9
    }
  ],
  "attachments": [
    {
      "url": "https://r2.example.com/images/unit-front.jpg",
      "key": "images/1704000000-abc123-unit-front.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 1024000,
      "caption": "Unit front entrance"
    },
    {
      "url": "https://r2.example.com/images/living-room.jpg",
      "key": "images/1704000001-def456-living-room.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 2048000,
      "caption": "Living room condition"
    }
  ]
}
```

### Response
```json
{
  "success": true,
  "data": {
    "id": "clm5678901234567890",
    "unitId": "clm1234567890abcdef",
    "ownerId": "clm0987654321fedcba",
    "createdByAdminId": "clmadmin123456789",
    "status": "DRAFT",
    "version": 1,
    "scheduledAt": "2024-01-15T10:00:00Z",
    "handoverAt": "2024-01-15T14:00:00Z",
    "notes": "Unit is in excellent condition. All appliances checked and working.",
    "createdAt": "2024-01-10T09:00:00Z",
    "updatedAt": "2024-01-10T09:00:00Z",
    "unit": {
      "id": "clm1234567890abcdef",
      "unitNumber": "A101",
      "buildingName": "Tower A",
      "floor": 10,
      "area": 120.5,
      "bedrooms": 2,
      "bathrooms": 2,
      "unitType": "Apartment",
      "address": "123 Main Street, Dubai"
    },
    "owner": {
      "id": "clm0987654321fedcba",
      "name": "John Smith",
      "email": "john.smith@example.com",
      "phone": "+971501234567",
      "nationalId": "784-1985-1234567-1"
    },
    "createdByAdmin": {
      "id": "clmadmin123456789",
      "name": "Admin User",
      "email": "admin@example.com"
    },
    "items": [...],
    "attachments": [...],
    "_count": {
      "messages": 0,
      "documents": 0
    }
  }
}
```

## 2. List Handovers

### Request (Admin - sees all)
```http
GET /api/handovers?status=SENT_TO_OWNER&page=1&limit=10&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <admin_token>
```

### Request (Owner - sees only their handovers)
```http
GET /api/handovers?page=1&limit=10
Authorization: Bearer <owner_token>
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "clm5678901234567890",
      "unitId": "clm1234567890abcdef",
      "ownerId": "clm0987654321fedcba",
      "status": "SENT_TO_OWNER",
      "scheduledAt": "2024-01-15T10:00:00Z",
      "handoverAt": "2024-01-15T14:00:00Z",
      "createdAt": "2024-01-10T09:00:00Z",
      "unit": {
        "id": "clm1234567890abcdef",
        "unitNumber": "A101",
        "buildingName": "Tower A",
        "floor": 10
      },
      "owner": {
        "id": "clm0987654321fedcba",
        "name": "John Smith",
        "email": "john.smith@example.com"
      },
      "_count": {
        "items": 9,
        "attachments": 2,
        "messages": 1,
        "documents": 0
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 3. Update Handover (Admin Only)

### Request
```http
PATCH /api/handovers/clm5678901234567890
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "handoverAt": "2024-01-16T14:00:00Z",
  "notes": "Updated: Unit is ready for handover. Minor issue with bathroom faucet noted.",
  "items": [
    {
      "id": "existing-item-id",
      "status": "OK",
      "actualValue": "Fixed",
      "notes": "Issue resolved by maintenance"
    }
  ],
  "attachments": [
    {
      "url": "https://r2.example.com/images/bathroom-fixed.jpg",
      "key": "images/1704100000-xyz789-bathroom-fixed.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 1536000,
      "caption": "Bathroom faucet after repair"
    }
  ]
}
```

## 4. Send to Owner (Admin Only)

### Request
```http
POST /api/handovers/clm5678901234567890/send
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "message": "Dear Mr. Smith, the unit A101 is ready for handover. Please review the details and confirm."
}
```

### Response
```json
{
  "success": true,
  "data": {
    "id": "clm5678901234567890",
    "status": "SENT_TO_OWNER",
    "updatedAt": "2024-01-10T10:00:00Z"
  },
  "message": "Handover sent to owner successfully"
}
```

## 5. Owner Confirm (Owner Only)

### Request
```http
POST /api/handovers/clm5678901234567890/owner-confirm
Content-Type: application/json
Authorization: Bearer <owner_token>

{
  "acknowledgement": "I have reviewed the handover details and confirm receipt of unit A101 in the described condition."
}
```

### Response
```json
{
  "success": true,
  "data": {
    "id": "clm5678901234567890",
    "status": "OWNER_CONFIRMED",
    "ownerConfirmedAt": "2024-01-11T15:30:00Z"
  },
  "message": "Handover confirmed successfully"
}
```

## 6. Request Changes (Owner Only)

### Request
```http
POST /api/handovers/clm5678901234567890/request-changes
Content-Type: application/json
Authorization: Bearer <owner_token>

{
  "message": "The kitchen appliances were not tested during inspection. Please include refrigerator and oven status."
}
```

### Response
```json
{
  "success": true,
  "data": {
    "id": "clm5678901234567890",
    "status": "CHANGES_REQUESTED"
  },
  "message": "Changes requested successfully"
}
```

## 7. Admin Confirm (Admin Only)

### Request
```http
POST /api/handovers/clm5678901234567890/admin-confirm
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "finalNotes": "All items verified. Ready for final documentation."
}
```

## 8. Complete Handover & Generate PDF (Admin Only)

### Request
```http
POST /api/handovers/clm5678901234567890/complete
Authorization: Bearer <admin_token>
```

### Response
```json
{
  "success": true,
  "data": {
    "id": "clm5678901234567890",
    "status": "COMPLETED",
    "completedAt": "2024-01-12T16:00:00Z",
    "document": {
      "id": "clmdoc123456789",
      "module": "HANDOVER",
      "entityId": "clm5678901234567890",
      "type": "PDF",
      "templateKey": "handover-agreement-v1",
      "version": 1,
      "url": "https://r2.example.com/handovers/clm5678901234567890/agreement-1704200000.pdf",
      "key": "handovers/clm5678901234567890/agreement-1704200000.pdf",
      "sha256Hash": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
      "sizeBytes": 245678,
      "title": "Handover Agreement",
      "description": "Formal unit handover agreement",
      "createdAt": "2024-01-12T16:00:00Z"
    }
  },
  "message": "Handover completed and PDF agreement generated successfully"
}
```

## 9. Cancel Handover (Admin Only)

### Request
```http
POST /api/handovers/clm5678901234567890/cancel
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "reason": "Owner requested to postpone handover due to travel"
}
```

## 10. Get Handover Messages

### Request
```http
GET /api/handovers/clm5678901234567890/messages?limit=20
Authorization: Bearer <token>
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "clmmsg789012345",
      "handoverId": "clm5678901234567890",
      "authorUserId": "clmadmin123456789",
      "authorRole": "ADMIN",
      "body": "Handover cancelled: Owner requested to postpone handover due to travel",
      "createdAt": "2024-01-12T17:00:00Z",
      "author": {
        "id": "clmadmin123456789",
        "name": "Admin User",
        "role": "ADMIN"
      }
    },
    {
      "id": "clmmsg678901234",
      "handoverId": "clm5678901234567890",
      "authorUserId": "clm0987654321fedcba",
      "authorRole": "OWNER",
      "body": "I have reviewed the handover details and confirm receipt of unit A101.",
      "createdAt": "2024-01-11T15:30:00Z",
      "author": {
        "id": "clm0987654321fedcba",
        "name": "John Smith",
        "role": "OWNER"
      }
    }
  ],
  "meta": {
    "hasMore": false,
    "nextCursor": null
  }
}
```

## 11. Add Message to Handover

### Request
```http
POST /api/handovers/clm5678901234567890/messages
Content-Type: application/json
Authorization: Bearer <token>

{
  "body": "Please note that the parking space B-15 is also included with this unit."
}
```

## 12. Upload Files (Get Presigned URLs)

### Request
```http
POST /api/uploads/r2/presign
Content-Type: application/json
Authorization: Bearer <token>

{
  "filename": "unit-kitchen.jpg",
  "mimeType": "image/jpeg",
  "type": "image",
  "prefix": "handovers"
}
```

### Response
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://r2.example.com/presigned-upload-url-here",
    "publicUrl": "https://r2.example.com/handovers/1704300000-abc123-unit-kitchen.jpg",
    "key": "handovers/1704300000-abc123-unit-kitchen.jpg"
  }
}
```

## 13. Get Documents for Handover

### Request
```http
GET /api/docs/module/HANDOVER/entity/clm5678901234567890
Authorization: Bearer <token>
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "clmdoc123456789",
      "module": "HANDOVER",
      "entityId": "clm5678901234567890",
      "type": "PDF",
      "templateKey": "handover-agreement-v1",
      "version": 1,
      "url": "https://r2.example.com/handovers/clm5678901234567890/agreement-1704200000.pdf",
      "sha256Hash": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
      "sizeBytes": 245678,
      "title": "Handover Agreement",
      "createdAt": "2024-01-12T16:00:00Z",
      "createdBy": {
        "id": "clmadmin123456789",
        "name": "Admin User",
        "email": "admin@example.com"
      }
    }
  ]
}
```

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "error": "Invalid state transition from COMPLETED to SENT_TO_OWNER"
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### Forbidden (403)
```json
{
  "success": false,
  "error": "Only administrators can create handovers"
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": "Handover not found"
}
```

## Workflow Summary

1. **Admin creates handover** (DRAFT)
2. **Admin sends to owner** (DRAFT → SENT_TO_OWNER)
3. **Owner reviews and either:**
   - Confirms (SENT_TO_OWNER → OWNER_CONFIRMED)
   - Requests changes (SENT_TO_OWNER → CHANGES_REQUESTED)
4. **If changes requested:** Admin updates and resends (CHANGES_REQUESTED → SENT_TO_OWNER)
5. **Admin performs final confirmation** (OWNER_CONFIRMED → ADMIN_CONFIRMED)
6. **Admin completes handover** (ADMIN_CONFIRMED → COMPLETED)
   - System generates PDF agreement
   - Handover becomes immutable
7. **Alternative:** Admin can cancel at any non-completed state (→ CANCELLED)

## Notes

- Messages can be added at any state, even after completion
- Once COMPLETED, no edits are allowed to the handover data
- PDF is generated from a frozen snapshot to ensure immutability
- All actions are audit logged
- Owners can only see/interact with handovers for units they own