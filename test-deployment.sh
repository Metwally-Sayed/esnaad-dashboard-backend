#!/bin/bash

# Test script for deployed backend
# Usage: ./test-deployment.sh YOUR_URL

if [ -z "$1" ]; then
  echo "Usage: ./test-deployment.sh YOUR_CLOUD_URL"
  echo "Example: ./test-deployment.sh https://esnaad-dashboard.claw.cloud"
  exit 1
fi

API_URL="$1"
echo "Testing backend at: $API_URL"
echo "================================"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Test Health Check
echo -e "\n1. Testing Health Check..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Health check passed${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ Health check failed (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
  exit 1
fi

# 2. Test Login
echo -e "\n2. Testing Login..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!"
  }')

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
BODY=$(echo "$LOGIN_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✓ Login successful${NC}"

  # Extract token using grep and sed
  TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

  if [ -n "$TOKEN" ]; then
    echo "Token received: ${TOKEN:0:20}..."
  else
    echo -e "${RED}Warning: Could not extract token${NC}"
  fi
else
  echo -e "${RED}✗ Login failed (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
  echo ""
  echo "Possible issues:"
  echo "1. Database not connected"
  echo "2. Migrations not run"
  echo "3. Seed data not loaded"
  exit 1
fi

# 3. Test Protected Endpoint
if [ -n "$TOKEN" ]; then
  echo -e "\n3. Testing Protected Endpoint (Get Users)..."
  USERS_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/users" \
    -H "Authorization: Bearer $TOKEN")

  HTTP_CODE=$(echo "$USERS_RESPONSE" | tail -n1)
  BODY=$(echo "$USERS_RESPONSE" | head -n-1)

  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Protected endpoint accessible${NC}"
    echo "Response: ${BODY:0:100}..."
  else
    echo -e "${RED}✗ Protected endpoint failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
  fi
fi

# 4. Test Database Connection
echo -e "\n4. Testing Projects Endpoint (DB Query)..."
PROJECTS_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$PROJECTS_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Database queries working${NC}"
else
  echo -e "${RED}✗ Database query failed (HTTP $HTTP_CODE)${NC}"
fi

echo -e "\n================================"
echo -e "${GREEN}Deployment test complete!${NC}"
echo ""
echo "Your backend is deployed at: $API_URL"
echo "You can now connect your frontend to this URL"