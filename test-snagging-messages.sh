#!/bin/bash

# Test script for Snagging Messages endpoint
# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:8080/api"

echo -e "${YELLOW}Testing Snagging Messages Endpoint${NC}"
echo "======================================="

# Step 1: Login as admin
echo -e "\n${YELLOW}1. Getting authentication token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.tokens.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to get auth token${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Authentication successful${NC}"

# Step 2: Create a unit for testing
echo -e "\n${YELLOW}2. Creating test unit...${NC}"
UNIT_RESPONSE=$(curl -s -X POST "$BASE_URL/units" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "unitNumber": "MSG-TEST-001",
    "unitType": "Apartment",
    "buildingName": "Test Tower",
    "floor": 5,
    "area": 100,
    "bedrooms": 2,
    "bathrooms": 1
  }')

UNIT_ID=$(echo "$UNIT_RESPONSE" | jq -r '.data.unit.id')

if [ "$UNIT_ID" = "null" ] || [ -z "$UNIT_ID" ]; then
  echo -e "${RED}Failed to create unit${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Unit created: $UNIT_ID${NC}"

# Step 3: Create a snagging for the unit
echo -e "\n${YELLOW}3. Creating snagging...${NC}"
SNAGGING_RESPONSE=$(curl -s -X POST "$BASE_URL/snaggings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"unitId\": \"$UNIT_ID\",
    \"title\": \"Test Issue\",
    \"description\": \"Testing messages endpoint\",
    \"priority\": \"MEDIUM\"
  }")

SNAGGING_ID=$(echo "$SNAGGING_RESPONSE" | jq -r '.data.id')

if [ "$SNAGGING_ID" = "null" ] || [ -z "$SNAGGING_ID" ]; then
  echo -e "${RED}Failed to create snagging${NC}"
  echo "$SNAGGING_RESPONSE" | jq '.'
  exit 1
fi

echo -e "${GREEN}✓ Snagging created: $SNAGGING_ID${NC}"

# Step 4: Add messages to the snagging
echo -e "\n${YELLOW}4. Adding messages to snagging...${NC}"
for i in {1..3}; do
  MSG_RESPONSE=$(curl -s -X POST "$BASE_URL/snaggings/$SNAGGING_ID/messages" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"bodyTitle\": \"Message $i\",
      \"bodyText\": \"This is test message number $i\"
    }")

  MSG_SUCCESS=$(echo "$MSG_RESPONSE" | jq -r '.success')
  if [ "$MSG_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Message $i added${NC}"
  else
    echo -e "${RED}✗ Failed to add message $i${NC}"
  fi
done

# Step 5: Test getting messages with different parameters
echo -e "\n${YELLOW}5. Testing messages endpoint with various parameters...${NC}"

# Test 1: Default parameters
echo -e "\n${YELLOW}Test 1: Default parameters${NC}"
RESPONSE=$(curl -s -w "\nTime: %{time_total}s" \
  -X GET "$BASE_URL/snaggings/$SNAGGING_ID/messages" \
  -H "Authorization: Bearer $TOKEN")

TIME=$(echo "$RESPONSE" | tail -n1 | cut -d' ' -f2)
SUCCESS=$(echo "$RESPONSE" | head -n-1 | jq -r '.success')
MESSAGE_COUNT=$(echo "$RESPONSE" | head -n-1 | jq '.data.data | length')

if [ "$SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Success | Time: $TIME | Messages: $MESSAGE_COUNT${NC}"
else
  echo -e "${RED}✗ Failed | Time: $TIME${NC}"
fi

# Test 2: With page and limit parameters
echo -e "\n${YELLOW}Test 2: With page=1&limit=2${NC}"
RESPONSE=$(curl -s -w "\nTime: %{time_total}s" \
  -X GET "$BASE_URL/snaggings/$SNAGGING_ID/messages?page=1&limit=2" \
  -H "Authorization: Bearer $TOKEN")

TIME=$(echo "$RESPONSE" | tail -n1 | cut -d' ' -f2)
SUCCESS=$(echo "$RESPONSE" | head -n-1 | jq -r '.success')
MESSAGE_COUNT=$(echo "$RESPONSE" | head -n-1 | jq '.data.data | length')

if [ "$SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Success | Time: $TIME | Messages: $MESSAGE_COUNT${NC}"
else
  echo -e "${RED}✗ Failed | Time: $TIME${NC}"
fi

# Test 3: With different limit values
echo -e "\n${YELLOW}Test 3: With limit=10${NC}"
RESPONSE=$(curl -s -w "\nTime: %{time_total}s" \
  -X GET "$BASE_URL/snaggings/$SNAGGING_ID/messages?limit=10" \
  -H "Authorization: Bearer $TOKEN")

TIME=$(echo "$RESPONSE" | tail -n1 | cut -d' ' -f2)
SUCCESS=$(echo "$RESPONSE" | head -n-1 | jq -r '.success')
MESSAGE_COUNT=$(echo "$RESPONSE" | head -n-1 | jq '.data.data | length')

if [ "$SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Success | Time: $TIME | Messages: $MESSAGE_COUNT${NC}"
else
  echo -e "${RED}✗ Failed | Time: $TIME${NC}"
fi

# Step 6: Test with invalid snagging ID
echo -e "\n${YELLOW}6. Testing with invalid snagging ID...${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/snaggings/invalid-id/messages" \
  -H "Authorization: Bearer $TOKEN")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
ERROR=$(echo "$RESPONSE" | jq -r '.error')

if [ "$SUCCESS" = "false" ]; then
  echo -e "${GREEN}✓ Correctly returned error: $ERROR${NC}"
else
  echo -e "${RED}✗ Should have failed but didn't${NC}"
fi

# Cleanup
echo -e "\n${YELLOW}7. Cleaning up test data...${NC}"
curl -s -X DELETE "$BASE_URL/units/$UNIT_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo -e "${GREEN}✓ Test unit and snagging deleted${NC}"

echo -e "\n${GREEN}✅ All message endpoint tests completed!${NC}"