#!/bin/bash

# Test script for Snagging Module
# Make sure the server is running on port 8080 before executing

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:8080/api"

# Step 1: Login as admin to get token
echo -e "${YELLOW}Step 1: Login as admin...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!"
  }')

echo "$LOGIN_RESPONSE" | jq '.'

# Extract token (from tokens object)
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.tokens.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to get auth token. Make sure you have seeded the database.${NC}"
  echo "Run: npm run prisma:seed"
  exit 1
fi

echo -e "${GREEN}✓ Got token${NC}"

# Step 2: Get units to find a unit ID
echo -e "\n${YELLOW}Step 2: Getting units...${NC}"
UNITS_RESPONSE=$(curl -s -X GET "$BASE_URL/units" \
  -H "Authorization: Bearer $TOKEN")

echo "$UNITS_RESPONSE" | jq '.'

# Extract first unit ID
UNIT_ID=$(echo "$UNITS_RESPONSE" | jq -r '.data.data[0].id')

if [ "$UNIT_ID" = "null" ] || [ -z "$UNIT_ID" ]; then
  echo -e "${RED}No units found. Please create a unit first.${NC}"
  # Create a unit
  echo -e "${YELLOW}Creating a test unit...${NC}"
  UNIT_CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/units" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "unitNumber": "TEST-001",
      "buildingName": "Test Building",
      "floor": 1,
      "area": 100.5,
      "bedrooms": 2,
      "bathrooms": 2,
      "description": "Test unit for snagging"
    }')

  echo "$UNIT_CREATE_RESPONSE" | jq '.'
  UNIT_ID=$(echo "$UNIT_CREATE_RESPONSE" | jq -r '.data.id')
fi

echo -e "${GREEN}✓ Using unit ID: $UNIT_ID${NC}"

# Step 3: Get presigned upload URLs (mock for now)
echo -e "\n${YELLOW}Step 3: Getting presigned upload URLs...${NC}"
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/uploads/r2/presign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "fileName": "crack_photo.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 2048576
      }
    ]
  }')

echo "$UPLOAD_RESPONSE" | jq '.'

# Extract public URL
PUBLIC_URL=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.uploads[0].publicUrl')

if [ "$PUBLIC_URL" = "null" ] || [ -z "$PUBLIC_URL" ]; then
  echo -e "${YELLOW}Warning: Upload service not configured, using placeholder URL${NC}"
  PUBLIC_URL="https://example.com/placeholder.jpg"
fi

echo -e "${GREEN}✓ Got upload URL: $PUBLIC_URL${NC}"

# Step 4: Create a snagging thread
echo -e "\n${YELLOW}Step 4: Creating a snagging thread...${NC}"
SNAGGING_RESPONSE=$(curl -s -X POST "$BASE_URL/snaggings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"unitId\": \"$UNIT_ID\",
    \"title\": \"Wall crack in bedroom\",
    \"description\": \"There is a large crack in the bedroom wall near the window that needs urgent attention\",
    \"priority\": \"HIGH\",
    \"attachments\": [
      {
        \"url\": \"$PUBLIC_URL\",
        \"fileName\": \"crack_photo.jpg\",
        \"mimeType\": \"image/jpeg\",
        \"sizeBytes\": 2048576
      }
    ]
  }")

echo "$SNAGGING_RESPONSE" | jq '.'

# Extract snagging ID
SNAGGING_ID=$(echo "$SNAGGING_RESPONSE" | jq -r '.data.id')

if [ "$SNAGGING_ID" = "null" ] || [ -z "$SNAGGING_ID" ]; then
  echo -e "${RED}Failed to create snagging${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Created snagging ID: $SNAGGING_ID${NC}"

# Step 5: Add a message to the thread
echo -e "\n${YELLOW}Step 5: Adding a message to the snagging thread...${NC}"
MESSAGE_RESPONSE=$(curl -s -X POST "$BASE_URL/snaggings/$SNAGGING_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bodyTitle": "Maintenance team assigned",
    "bodyText": "Our maintenance team has been notified and will inspect the wall crack tomorrow at 10 AM."
  }')

echo "$MESSAGE_RESPONSE" | jq '.'

# Step 6: Get messages from the thread
echo -e "\n${YELLOW}Step 6: Getting messages from the thread...${NC}"
MESSAGES_RESPONSE=$(curl -s -X GET "$BASE_URL/snaggings/$SNAGGING_ID/messages?limit=10" \
  -H "Authorization: Bearer $TOKEN")

echo "$MESSAGES_RESPONSE" | jq '.'

# Step 7: List all snaggings (admin only)
echo -e "\n${YELLOW}Step 7: Listing all snaggings...${NC}"
LIST_RESPONSE=$(curl -s -X GET "$BASE_URL/snaggings?page=1&limit=10&status=OPEN&priority=HIGH" \
  -H "Authorization: Bearer $TOKEN")

echo "$LIST_RESPONSE" | jq '.'

# Step 8: Get snaggings for the specific unit
echo -e "\n${YELLOW}Step 8: Getting snaggings for unit $UNIT_ID...${NC}"
UNIT_SNAGGINGS_RESPONSE=$(curl -s -X GET "$BASE_URL/units/$UNIT_ID/snaggings" \
  -H "Authorization: Bearer $TOKEN")

echo "$UNIT_SNAGGINGS_RESPONSE" | jq '.'

# Step 9: Update the snagging status
echo -e "\n${YELLOW}Step 9: Updating snagging status to IN_PROGRESS...${NC}"
UPDATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/snaggings/$SNAGGING_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS",
    "priority": "URGENT"
  }')

echo "$UPDATE_RESPONSE" | jq '.'

# Step 10: Get my snaggings (as the logged-in user)
echo -e "\n${YELLOW}Step 10: Getting my snaggings...${NC}"
MY_SNAGGINGS_RESPONSE=$(curl -s -X GET "$BASE_URL/snaggings/my" \
  -H "Authorization: Bearer $TOKEN")

echo "$MY_SNAGGINGS_RESPONSE" | jq '.'

echo -e "\n${GREEN}✅ All tests completed successfully!${NC}"
echo -e "${GREEN}Created snagging ID: $SNAGGING_ID${NC}"
echo -e "${GREEN}For unit ID: $UNIT_ID${NC}"