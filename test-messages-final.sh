#!/bin/bash

# Quick test for messages endpoint
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImY5ZGI0ZGM3LWQyZTctNGE1Yy05NWFiLTdhY2FjZGIwZWU3YiIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NjczOTk5NTgsImV4cCI6MTc2ODAwNDc1OH0.jC7aqibH5vPGqyNwCFoJeliyn3LpRLbtXv7YQ4_aTFs"
BASE_URL="http://localhost:8080/api"

echo "Creating test unit..."
UNIT=$(curl -s -X POST "$BASE_URL/units" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "unitNumber": "FINAL-TEST-001",
    "unitType": "Apartment",
    "buildingName": "Test",
    "floor": 1,
    "area": 50,
    "bedrooms": 1,
    "bathrooms": 1
  }')
UNIT_ID=$(echo "$UNIT" | jq -r '.data.unit.id')
echo "Unit created: $UNIT_ID"

echo "Creating snagging..."
SNAGGING=$(curl -s -X POST "$BASE_URL/snaggings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"unitId\": \"$UNIT_ID\",
    \"title\": \"Test Issue\",
    \"description\": \"Testing messages\",
    \"priority\": \"LOW\"
  }")
SNAGGING_ID=$(echo "$SNAGGING" | jq -r '.data.id')
echo "Snagging created: $SNAGGING_ID"

echo "Adding message..."
MSG=$(curl -s -X POST "$BASE_URL/snaggings/$SNAGGING_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bodyTitle": "Test Message",
    "bodyText": "This is a test message"
  }')
echo "Message response: $(echo "$MSG" | jq -r '.success')"

echo "Getting messages..."
MESSAGES=$(curl -s -X GET "$BASE_URL/snaggings/$SNAGGING_ID/messages?limit=10" \
  -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo "$MESSAGES" | jq -r '.success')
COUNT=$(echo "$MESSAGES" | jq '.data.data | length')
echo "Get messages success: $SUCCESS, Count: $COUNT"

if [ "$SUCCESS" = "true" ]; then
  echo "✅ Messages endpoint working!"
else
  echo "❌ Messages endpoint failed!"
  echo "$MESSAGES" | jq '.'
fi

# Cleanup
curl -s -X DELETE "$BASE_URL/units/$UNIT_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
echo "Cleanup completed"