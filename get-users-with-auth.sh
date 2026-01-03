#!/bin/bash

# Script to get users with proper authentication

BASE_URL="http://localhost:8080/api"

# Step 1: Login to get token
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!"
  }')

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.tokens.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to get auth token. Make sure the admin user exists."
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "✓ Authentication successful"
echo "Token: ${TOKEN:0:30}..."

# Step 2: Get users with the token
echo -e "\n2. Getting users with role=OWNER and limit=100..."
USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/users?limit=100&role=OWNER" \
  -H "Authorization: Bearer $TOKEN")

# Check if successful
SUCCESS=$(echo "$USERS_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  # Count users
  USER_COUNT=$(echo "$USERS_RESPONSE" | jq '.data.data | length')
  TOTAL_USERS=$(echo "$USERS_RESPONSE" | jq -r '.data.meta.total')

  echo "✓ Successfully retrieved users"
  echo "Users returned: $USER_COUNT"
  echo "Total users with role=OWNER: $TOTAL_USERS"

  # Display user list
  echo -e "\nUser List (OWNER role):"
  echo "$USERS_RESPONSE" | jq -r '.data.data[] | "- \(.name) (\(.email)) - ID: \(.id)"'

  # Display pagination info
  echo -e "\nPagination Info:"
  echo "$USERS_RESPONSE" | jq '.data.meta'
else
  echo "Failed to get users"
  echo "$USERS_RESPONSE" | jq '.'
fi

# Step 3: Try without role filter to get all users
echo -e "\n3. Getting ALL users (no role filter)..."
ALL_USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/users?limit=100" \
  -H "Authorization: Bearer $TOKEN")

ALL_SUCCESS=$(echo "$ALL_USERS_RESPONSE" | jq -r '.success')

if [ "$ALL_SUCCESS" = "true" ]; then
  ALL_COUNT=$(echo "$ALL_USERS_RESPONSE" | jq '.data.data | length')
  ALL_TOTAL=$(echo "$ALL_USERS_RESPONSE" | jq -r '.data.meta.total')

  echo "✓ Successfully retrieved all users"
  echo "Users returned: $ALL_COUNT"
  echo "Total users in system: $ALL_TOTAL"

  # Group by role
  echo -e "\nUsers by Role:"
  echo "ADMIN users:"
  echo "$ALL_USERS_RESPONSE" | jq -r '.data.data[] | select(.role == "ADMIN") | "  - \(.name) (\(.email))"'

  echo "OWNER users:"
  echo "$ALL_USERS_RESPONSE" | jq -r '.data.data[] | select(.role == "OWNER") | "  - \(.name) (\(.email))"'
fi

echo -e "\n✅ Complete!"