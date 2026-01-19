#!/bin/bash

# Test Ownership Transfer Request Creation
# This script tests creating an ownership transfer request

echo "Testing Ownership Transfer Request..."
echo "======================================"
echo ""

# Replace with your actual token and unit IDs
TOKEN="YOUR_TOKEN_HERE"
API_URL="http://localhost:8080/api/requests"

# Test 1: Create ownership transfer with NEW owner
echo "Test 1: Creating ownership transfer with NEW owner..."
curl -X POST "$API_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "OWNERSHIP_TRANSFER",
    "transferUnitIds": ["cmkh8oir30001182iju3oodzo"],
    "newOwnerName": "Test New Owner",
    "newOwnerEmail": "newowner@test.com",
    "newOwnerPhone": "+966501234567"
  }' \
  | jq '.'

echo ""
echo ""

# Test 2: Create ownership transfer with EXISTING owner
echo "Test 2: Creating ownership transfer with EXISTING owner..."
echo "(Replace EXISTING_OWNER_ID with actual owner ID)"
curl -X POST "$API_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "OWNERSHIP_TRANSFER",
    "transferUnitIds": ["cmkh8oir30001182iju3oodzo"],
    "newOwnerId": "EXISTING_OWNER_ID",
    "newOwnerName": "Existing Owner",
    "newOwnerEmail": "existing@test.com"
  }' \
  | jq '.'

echo ""
echo "======================================"
echo "Tests complete!"
