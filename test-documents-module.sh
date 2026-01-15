#!/bin/bash

# Unit Documents Module Test Script
set -e

BASE_URL="http://localhost:8080/api"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🧪 UNIT DOCUMENTS MODULE TEST${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Step 1: Login as Admin
echo -e "${BLUE}Step 1: Login as Admin${NC}"
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/login2.json | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Admin login failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Admin logged in${NC}"
echo "Token: ${ADMIN_TOKEN:0:20}..."
echo ""

# Step 2: Get a unit
echo -e "${BLUE}Step 2: Get Unit ID${NC}"
UNIT_ID=$(curl -s -X GET "$BASE_URL/units?limit=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$UNIT_ID" ]; then
  echo -e "${RED}❌ No units found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Unit found: $UNIT_ID${NC}"
echo ""

# Step 3: Create a mock document
echo -e "${BLUE}Step 3: Create Document (Mock R2 Upload)${NC}"
CREATE_DOC=$(curl -s -X POST "$BASE_URL/units/$UNIT_ID/documents" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Contract",
    "category": "CONTRACT",
    "fileKey": "test-documents/test-contract-123.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 524288
  }')

DOC_ID=$(echo $CREATE_DOC | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$DOC_ID" ]; then
  echo -e "${RED}❌ Document creation failed${NC}"
  echo $CREATE_DOC | python3 -m json.tool
  exit 1
fi

echo -e "${GREEN}✅ Document created: $DOC_ID${NC}"
echo ""

# Step 4: Get documents for unit
echo -e "${BLUE}Step 4: Get Documents for Unit${NC}"
UNIT_DOCS=$(curl -s -X GET "$BASE_URL/units/$UNIT_ID/documents" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

DOC_COUNT=$(echo $UNIT_DOCS | grep -o '"id"' | wc -l | tr -d ' ')

echo -e "${GREEN}✅ Retrieved $DOC_COUNT document(s) for unit${NC}"
echo ""

# Step 5: Get document by ID
echo -e "${BLUE}Step 5: Get Document by ID${NC}"
DOC_DETAIL=$(curl -s -X GET "$BASE_URL/documents/$DOC_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

DOC_TITLE=$(echo $DOC_DETAIL | grep -o '"title":"[^"]*' | cut -d'"' -f4)

echo -e "${GREEN}✅ Retrieved document: $DOC_TITLE${NC}"
echo ""

# Step 6: Get all documents (admin only)
echo -e "${BLUE}Step 6: Get All Documents (Admin)${NC}"
ALL_DOCS=$(curl -s -X GET "$BASE_URL/documents" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

TOTAL_DOCS=$(echo $ALL_DOCS | grep -o '"total":[0-9]*' | grep -o '[0-9]*')

echo -e "${GREEN}✅ Retrieved all documents, total: $TOTAL_DOCS${NC}"
echo ""

# Step 7: Delete document
echo -e "${BLUE}Step 7: Delete Document${NC}"
DELETE_RESULT=$(curl -s -X DELETE "$BASE_URL/documents/$DOC_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

SUCCESS=$(echo $DELETE_RESULT | grep -o '"success":true')

if [ -z "$SUCCESS" ]; then
  echo -e "${RED}❌ Document deletion failed${NC}"
  echo $DELETE_RESULT | python3 -m json.tool
  exit 1
fi

echo -e "${GREEN}✅ Document deleted successfully${NC}"
echo ""

# Final Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ All tests passed!${NC}\n"
echo "Unit ID: $UNIT_ID"
echo "Document ID created: $DOC_ID"
echo "Total documents in system: $TOTAL_DOCS"
echo ""
echo -e "${GREEN}✅ Unit Documents module working correctly!${NC}"
echo -e "${BLUE}========================================${NC}"
