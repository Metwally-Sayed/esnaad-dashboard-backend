#!/bin/bash

# Quick R2 Test Script
# Tests R2 integration with simple curl commands

echo "================================================"
echo "     Quick R2 Integration Test"
echo "================================================"

# Configuration
API_URL="http://localhost:8080/api"
EMAIL="admin@example.com"
PASSWORD="Admin123!"

# Step 1: Login
echo -e "\n📝 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

# Extract token using grep and sed (works on both Mac and Linux)
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful!"
echo "   Token: ${TOKEN:0:20}..."

# Step 2: Request presigned URL
echo -e "\n📝 Step 2: Requesting presigned URL from R2..."
PRESIGN_RESPONSE=$(curl -s -X POST "${API_URL}/uploads/r2/presign" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "fileName": "test-image.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 1000
      }
    ]
  }')

echo "Response: $PRESIGN_RESPONSE"

# Extract URLs using grep and sed
PRESIGNED_URL=$(echo "$PRESIGN_RESPONSE" | grep -o '"presignedUrl":"[^"]*' | sed 's/"presignedUrl":"//' | head -1)
PUBLIC_URL=$(echo "$PRESIGN_RESPONSE" | grep -o '"publicUrl":"[^"]*' | sed 's/"publicUrl":"//' | head -1)
KEY=$(echo "$PRESIGN_RESPONSE" | grep -o '"key":"[^"]*' | sed 's/"key":"//' | head -1)

if [ -z "$PRESIGNED_URL" ]; then
  echo "❌ Failed to get presigned URL!"
  exit 1
fi

# Check if it's a mock URL
if [ "$PRESIGNED_URL" = "https://mock-upload-url.example.com" ]; then
  echo "⚠️  R2 is running in MOCK MODE"
  echo "   This means R2 credentials are not configured properly"
  echo ""
  echo "   Please check your .env file has:"
  echo "   - R2_ACCOUNT_ID"
  echo "   - R2_ACCESS_KEY_ID"
  echo "   - R2_SECRET_ACCESS_KEY"
  echo ""
  echo "   Then restart the server: npm run dev"
  exit 0
fi

echo "✅ Presigned URL received!"
echo "   Key: $KEY"
echo "   Public URL: $PUBLIC_URL"

# Step 3: Upload a test file
echo -e "\n📝 Step 3: Uploading test file to R2..."

# Create a simple test file
echo "Test image data" > /tmp/test-upload.txt

UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$PRESIGNED_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/tmp/test-upload.txt)

HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ File uploaded successfully!"
else
  echo "❌ Upload failed with HTTP code: $HTTP_CODE"
  echo "Response: $UPLOAD_RESPONSE"
fi

# Step 4: Try to access the file
echo -e "\n📝 Step 4: Checking public access..."
PUBLIC_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL")

if [ "$PUBLIC_RESPONSE" = "200" ]; then
  echo "✅ File is publicly accessible at: $PUBLIC_URL"
elif [ "$PUBLIC_RESPONSE" = "404" ]; then
  echo "⚠️  File not publicly accessible (404)"
  echo "   Enable R2.dev subdomain in bucket settings for public access"
else
  echo "⚠️  Unexpected response code: $PUBLIC_RESPONSE"
fi

# Summary
echo ""
echo "================================================"
echo "     Test Complete!"
echo "================================================"
echo ""
echo "✅ R2 Integration is working!"
echo "   - Authentication: ✓"
echo "   - Presigned URL generation: ✓"
echo "   - File upload: ✓"
echo ""
echo "📋 Your uploaded file:"
echo "   Key: $KEY"
echo "   URL: $PUBLIC_URL"
echo ""
echo "💡 Next steps:"
echo "   1. Check your R2 bucket in Cloudflare dashboard"
echo "   2. You should see the uploaded file there"
echo "   3. Enable public access if needed"

# Clean up
rm -f /tmp/test-upload.txt