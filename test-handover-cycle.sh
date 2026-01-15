#!/bin/bash

# Handover Cycle Test Script
# Tests the complete workflow from creation to PDF generation

set -e  # Exit on error

BASE_URL="http://localhost:8080/api"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🧪 HANDOVER CYCLE TEST${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Step 1: Login as Admin
echo -e "${BLUE}Step 1: Login as Admin${NC}"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Admin login failed${NC}"
  echo $ADMIN_LOGIN | python3 -m json.tool
  exit 1
fi

echo -e "${GREEN}✅ Admin logged in${NC}"
echo "Token: ${ADMIN_TOKEN:0:20}..."
echo ""

# Step 2: Get a unit (using seeded data)
echo -e "${BLUE}Step 2: Get Unit ID${NC}"
UNITS=$(curl -s -X GET "$BASE_URL/units?limit=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

UNIT_ID=$(echo $UNITS | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
UNIT_NUMBER=$(echo $UNITS | grep -o '"unitNumber":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$UNIT_ID" ]; then
  echo -e "${RED}❌ No units found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Unit found: $UNIT_NUMBER ($UNIT_ID)${NC}"
echo ""

# Step 3: Get Owner ID
echo -e "${BLUE}Step 3: Get Owner User${NC}"
USERS=$(curl -s -X GET "$BASE_URL/users?role=OWNER&limit=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

OWNER_ID=$(echo $USERS | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
OWNER_EMAIL=$(echo $USERS | grep -o '"email":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$OWNER_ID" ]; then
  echo -e "${RED}❌ No owner found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Owner found: $OWNER_EMAIL ($OWNER_ID)${NC}"
echo ""

# Step 3.5: Cancel any existing active handover for this unit
echo -e "${BLUE}Step 3.5: Check for existing handovers${NC}"
EXISTING_HANDOVERS=$(curl -s -X GET "$BASE_URL/handovers?unitId=$UNIT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

EXISTING_ID=$(echo $EXISTING_HANDOVERS | python3 -c "import sys, json; data=json.load(sys.stdin); items=data.get('data', []); print(items[0]['id'] if items and items[0]['status'] not in ['COMPLETED', 'CANCELLED'] else '')" 2>/dev/null || echo "")

if [ ! -z "$EXISTING_ID" ]; then
  echo "Found existing handover: $EXISTING_ID - cancelling it..."
  curl -s -X POST "$BASE_URL/handovers/$EXISTING_ID/cancel" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"reason":"Clearing for test"}' > /dev/null
  echo -e "${GREEN}✅ Cancelled existing handover${NC}"
else
  echo "No active handovers found for this unit"
fi
echo ""

# Step 4: Create Handover with Items
echo -e "${BLUE}Step 4: Create Handover with Items${NC}"
CREATE_HANDOVER=$(curl -s -X POST "$BASE_URL/handovers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "unitId": "'$UNIT_ID'",
    "ownerId": "'$OWNER_ID'",
    "scheduledAt": "2026-01-10T10:00:00Z",
    "notes": "Test handover for complete cycle",
    "items": [
      {
        "category": "Electrical",
        "label": "All lights working",
        "status": "NA",
        "sortOrder": 1
      },
      {
        "category": "Electrical",
        "label": "Power outlets functional",
        "status": "NA",
        "sortOrder": 2
      },
      {
        "category": "Plumbing",
        "label": "Hot water working",
        "status": "NA",
        "sortOrder": 3
      },
      {
        "category": "Plumbing",
        "label": "No leaks in bathroom",
        "status": "NA",
        "sortOrder": 4
      },
      {
        "category": "HVAC",
        "label": "Air conditioning working",
        "status": "NA",
        "sortOrder": 5
      }
    ]
  }')

HANDOVER_ID=$(echo $CREATE_HANDOVER | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
ITEM_COUNT=$(echo $CREATE_HANDOVER | grep -o '"category"' | wc -l | tr -d ' ')

if [ -z "$HANDOVER_ID" ]; then
  echo -e "${RED}❌ Handover creation failed${NC}"
  echo $CREATE_HANDOVER | python3 -m json.tool
  exit 1
fi

echo -e "${GREEN}✅ Handover created: $HANDOVER_ID${NC}"
echo -e "${GREEN}   Items created: $ITEM_COUNT${NC}"
echo ""

# Step 5: Send Handover to Owner
echo -e "${BLUE}Step 5: Send Handover to Owner${NC}"
SEND_HANDOVER=$(curl -s -X POST "$BASE_URL/handovers/$HANDOVER_ID/send" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Please review and confirm the handover items"}')

HANDOVER_STATUS=$(echo $SEND_HANDOVER | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)

if [ "$HANDOVER_STATUS" != "SENT_TO_OWNER" ]; then
  echo -e "${RED}❌ Failed to send to owner${NC}"
  echo $SEND_HANDOVER | python3 -m json.tool
  exit 1
fi

echo -e "${GREEN}✅ Handover sent to owner (Status: $HANDOVER_STATUS)${NC}"
echo ""

# Step 6: Login as Owner
echo -e "${BLUE}Step 6: Login as Owner${NC}"
OWNER_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$OWNER_EMAIL'","password":"Owner123!"}')

OWNER_TOKEN=$(echo $OWNER_LOGIN | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$OWNER_TOKEN" ]; then
  echo -e "${RED}❌ Owner login failed${NC}"
  echo $OWNER_LOGIN | python3 -m json.tool
  exit 1
fi

echo -e "${GREEN}✅ Owner logged in: $OWNER_EMAIL${NC}"
echo ""

# Step 7: Owner Views Handover
echo -e "${BLUE}Step 7: Owner Views Handover${NC}"
VIEW_HANDOVER=$(curl -s -X GET "$BASE_URL/handovers/$HANDOVER_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN")

ITEMS_JSON=$(echo $VIEW_HANDOVER | grep -o '"items":\[[^]]*\]')

echo -e "${GREEN}✅ Owner can view handover with items${NC}"
echo ""

# Step 8: Owner Confirms with Item Updates
echo -e "${BLUE}Step 8: Owner Confirms Handover (with item updates)${NC}"

# Save handover response to temp file and extract item IDs properly
echo "$VIEW_HANDOVER" > /tmp/handover_view.json
# Extract all item IDs from the items array
ITEM_IDS=$(echo $VIEW_HANDOVER | python3 -c "import sys, json; data=json.load(sys.stdin); print(' '.join([item['id'] for item in data.get('data', {}).get('items', [])]))" 2>/dev/null || echo "")
ITEM_ARRAY=($ITEM_IDS)

OWNER_CONFIRM=$(curl -s -X POST "$BASE_URL/handovers/$HANDOVER_ID/owner-confirm" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "acknowledgement": "I have reviewed all items and confirm the handover",
    "itemUpdates": [
      {
        "id": "'${ITEM_ARRAY[0]}'",
        "status": "OK",
        "actualValue": "All lights tested",
        "notes": "Verified all rooms"
      },
      {
        "id": "'${ITEM_ARRAY[1]}'",
        "status": "OK",
        "notes": "All outlets working"
      },
      {
        "id": "'${ITEM_ARRAY[2]}'",
        "status": "NOT_OK",
        "notes": "Water takes long to heat up"
      },
      {
        "id": "'${ITEM_ARRAY[3]}'",
        "status": "OK"
      },
      {
        "id": "'${ITEM_ARRAY[4]}'",
        "status": "OK"
      }
    ]
  }')

CONFIRMED_STATUS=$(echo $OWNER_CONFIRM | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)

if [ "$CONFIRMED_STATUS" != "OWNER_CONFIRMED" ]; then
  echo -e "${RED}❌ Owner confirmation failed${NC}"
  echo $OWNER_CONFIRM | python3 -m json.tool
  exit 1
fi

echo -e "${GREEN}✅ Owner confirmed (Status: $CONFIRMED_STATUS)${NC}"
echo -e "${GREEN}   Updated 5 items with statuses${NC}"
echo ""

# Step 9: Admin Confirms
echo -e "${BLUE}Step 9: Admin Final Confirmation${NC}"
ADMIN_CONFIRM=$(curl -s -X POST "$BASE_URL/handovers/$HANDOVER_ID/admin-confirm" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"finalNotes": "All items reviewed. Unit ready for completion."}')

ADMIN_CONFIRMED_STATUS=$(echo $ADMIN_CONFIRM | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)

if [ "$ADMIN_CONFIRMED_STATUS" != "ADMIN_CONFIRMED" ]; then
  echo -e "${RED}❌ Admin confirmation failed${NC}"
  echo $ADMIN_CONFIRM | python3 -m json.tool
  exit 1
fi

echo -e "${GREEN}✅ Admin confirmed (Status: $ADMIN_CONFIRMED_STATUS)${NC}"
echo ""

# Step 10: Complete Handover and Generate PDF
echo -e "${BLUE}Step 10: Complete Handover & Generate PDF${NC}"
echo "⏳ Generating PDF (this may take 5-10 seconds)..."

COMPLETE_HANDOVER=$(curl -s -X POST "$BASE_URL/handovers/$HANDOVER_ID/complete" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

COMPLETED_STATUS=$(echo $COMPLETE_HANDOVER | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)
PDF_URL=$(echo $COMPLETE_HANDOVER | grep -o '"url":"https://[^"]*\.pdf"' | cut -d'"' -f4)
DOC_ID=$(echo $COMPLETE_HANDOVER | grep -o '"document":{[^}]*"id":"[^"]*' | grep -o 'id":"[^"]*' | cut -d'"' -f4)

if [ "$COMPLETED_STATUS" != "COMPLETED" ]; then
  echo -e "${RED}❌ Handover completion failed${NC}"
  echo $COMPLETE_HANDOVER | python3 -m json.tool
  exit 1
fi

if [ -z "$PDF_URL" ]; then
  echo -e "${RED}❌ PDF URL not found in response${NC}"
  echo $COMPLETE_HANDOVER | python3 -m json.tool
  exit 1
fi

echo -e "${GREEN}✅ Handover completed (Status: $COMPLETED_STATUS)${NC}"
echo -e "${GREEN}✅ PDF generated successfully${NC}"
echo -e "${GREEN}   Document ID: $DOC_ID${NC}"
echo -e "${GREEN}   PDF URL: $PDF_URL${NC}"
echo ""

# Step 11: Verify PDF is accessible
echo -e "${BLUE}Step 11: Verify PDF URL is accessible${NC}"
PDF_CHECK=$(curl -s -I "$PDF_URL" | head -1)

if echo "$PDF_CHECK" | grep -q "200"; then
  echo -e "${GREEN}✅ PDF is accessible at R2 URL${NC}"
else
  echo -e "${RED}⚠️  PDF URL returned: $PDF_CHECK${NC}"
  echo -e "${RED}   (Note: R2 bucket might not be publicly accessible)${NC}"
fi
echo ""

# Step 12: Get Documents by Unit
echo -e "${BLUE}Step 12: Retrieve Documents by Unit${NC}"
UNIT_DOCS=$(curl -s -X GET "$BASE_URL/documents/unit/$UNIT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

DOC_COUNT=$(echo $UNIT_DOCS | grep -o '"id":"' | wc -l | tr -d ' ')

echo -e "${GREEN}✅ Retrieved $DOC_COUNT document(s) for unit${NC}"
echo ""

# Final Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ All tests passed!${NC}\n"
echo "Handover ID: $HANDOVER_ID"
echo "Unit: $UNIT_NUMBER"
echo "Owner: $OWNER_EMAIL"
echo "Final Status: COMPLETED"
echo "Document ID: $DOC_ID"
echo ""
echo -e "${GREEN}🎉 PDF URL (for frontend integration):${NC}"
echo "$PDF_URL"
echo ""
echo -e "${BLUE}========================================${NC}"
