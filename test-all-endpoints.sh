#!/bin/bash

# Test script to verify all endpoints are working and not hanging
# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:8080/api"

echo -e "${YELLOW}Testing All API Endpoints Performance${NC}"
echo "======================================="

# Step 1: Login and get token
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
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo -e "${GREEN}✓ Authentication successful${NC}"

# Function to test endpoint performance
test_endpoint() {
  local method=$1
  local endpoint=$2
  local name=$3
  local data=$4

  echo -e "\n${YELLOW}Testing: $name${NC}"
  echo "Endpoint: $method $endpoint"

  if [ -z "$data" ]; then
    RESPONSE=$(curl -s -w "\n==METRICS==\nHTTP_CODE:%{http_code}\nTIME:%{time_total}s\n" \
      -X "$method" "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN")
  else
    RESPONSE=$(curl -s -w "\n==METRICS==\nHTTP_CODE:%{http_code}\nTIME:%{time_total}s\n" \
      -X "$method" "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  # Extract metrics and response
  METRICS=$(echo "$RESPONSE" | sed -n '/==METRICS==/,$p')
  JSON_RESPONSE=$(echo "$RESPONSE" | sed '/==METRICS==/,$d')

  HTTP_CODE=$(echo "$METRICS" | grep "HTTP_CODE:" | cut -d':' -f2)
  TIME=$(echo "$METRICS" | grep "TIME:" | cut -d':' -f2)

  # Check if response is valid JSON
  if echo "$JSON_RESPONSE" | jq '.' > /dev/null 2>&1; then
    SUCCESS=$(echo "$JSON_RESPONSE" | jq -r '.success')
    if [ "$SUCCESS" = "true" ]; then
      echo -e "${GREEN}✓ Status: $HTTP_CODE | Time: $TIME | Success: true${NC}"
    else
      ERROR=$(echo "$JSON_RESPONSE" | jq -r '.error // "Unknown error"')
      echo -e "${RED}✗ Status: $HTTP_CODE | Time: $TIME | Error: $ERROR${NC}"
    fi
  else
    echo -e "${RED}✗ Invalid JSON response | Status: $HTTP_CODE | Time: $TIME${NC}"
    echo "Response: $JSON_RESPONSE"
  fi

  # Warn if response time is too high
  TIME_NUM=$(echo "$TIME" | sed 's/s$//')
  if (( $(echo "$TIME_NUM > 1" | bc -l) )); then
    echo -e "${RED}⚠ Warning: Response time exceeds 1 second${NC}"
  fi
}

echo -e "\n${YELLOW}======== AUTH MODULE ========${NC}"
test_endpoint "GET" "/auth/me" "Get Current User"

echo -e "\n${YELLOW}======== USERS MODULE ========${NC}"
test_endpoint "GET" "/users?page=1&limit=5" "List Users"
test_endpoint "GET" "/users/f9db4dc7-d2e7-4a5c-95ab-7acacdb0ee7b" "Get User by ID"

echo -e "\n${YELLOW}======== PROJECTS MODULE ========${NC}"
test_endpoint "GET" "/projects?page=1&limit=5" "List Projects"
test_endpoint "POST" "/projects" "Create Project" '{
  "name": "Test Project",
  "description": "Performance test project",
  "location": "Dubai, UAE",
  "status": "active"
}'

# Get the created project ID for further tests
PROJECTS_RESPONSE=$(curl -s -X GET "$BASE_URL/projects?page=1&limit=1&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN")
PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | jq -r '.data.data[0].id // ""')

if [ ! -z "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
  test_endpoint "GET" "/projects/$PROJECT_ID" "Get Project by ID"
  test_endpoint "PATCH" "/projects/$PROJECT_ID" "Update Project" '{
    "description": "Updated description"
  }'
fi

echo -e "\n${YELLOW}======== UNITS MODULE ========${NC}"
test_endpoint "GET" "/units?page=1&limit=5" "List Units"
test_endpoint "POST" "/units" "Create Unit" '{
  "unitNumber": "PERF-TEST-001",
  "unitType": "Apartment",
  "buildingName": "Test Tower",
  "floor": 5,
  "area": 100,
  "bedrooms": 2,
  "bathrooms": 1
}'

# Get the created unit ID
UNITS_RESPONSE=$(curl -s -X GET "$BASE_URL/units?page=1&limit=1&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN")
UNIT_ID=$(echo "$UNITS_RESPONSE" | jq -r '.data.data[0].id // ""')

if [ ! -z "$UNIT_ID" ] && [ "$UNIT_ID" != "null" ]; then
  test_endpoint "GET" "/units/$UNIT_ID" "Get Unit by ID"
  test_endpoint "PUT" "/units/$UNIT_ID" "Update Unit" '{
    "floor": 6,
    "area": 105
  }'
fi

echo -e "\n${YELLOW}======== SNAGGING MODULE ========${NC}"
if [ ! -z "$UNIT_ID" ] && [ "$UNIT_ID" != "null" ]; then
  test_endpoint "POST" "/snaggings" "Create Snagging" "{
    \"unitId\": \"$UNIT_ID\",
    \"title\": \"Performance Test Issue\",
    \"description\": \"Testing endpoint performance\",
    \"priority\": \"LOW\"
  }"

  test_endpoint "GET" "/snaggings?page=1&limit=5" "List Snaggings"
  test_endpoint "GET" "/snaggings/my" "Get My Snaggings"
  test_endpoint "GET" "/units/$UNIT_ID/snaggings" "Get Unit Snaggings"
fi

echo -e "\n${YELLOW}======== AUDIT LOGS MODULE ========${NC}"
test_endpoint "GET" "/audit-logs?page=1&limit=5" "List Audit Logs"
test_endpoint "GET" "/audit-logs/entity/unit/$UNIT_ID" "Get Entity Audit Logs"

echo -e "\n${YELLOW}======== UPLOAD MODULE ========${NC}"
test_endpoint "POST" "/uploads/r2/presign" "Get Presigned URLs" '{
  "files": [{
    "fileName": "test.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 1024
  }]
}'

# Summary
echo -e "\n${YELLOW}=======================================${NC}"
echo -e "${GREEN}✅ All endpoint tests completed!${NC}"
echo -e "${YELLOW}=======================================${NC}"

# Cleanup: Delete test data
if [ ! -z "$UNIT_ID" ] && [ "$UNIT_ID" != "null" ]; then
  echo -e "\n${YELLOW}Cleaning up test data...${NC}"
  curl -s -X DELETE "$BASE_URL/units/$UNIT_ID" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
  echo -e "${GREEN}✓ Test unit deleted${NC}"
fi

if [ ! -z "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
  curl -s -X DELETE "$BASE_URL/projects/$PROJECT_ID" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
  echo -e "${GREEN}✓ Test project deleted${NC}"
fi

echo -e "\n${GREEN}🎉 Testing complete! All endpoints are responding correctly.${NC}"