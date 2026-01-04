# Cloudflare R2 Integration Setup Guide

## Overview
This guide will walk you through setting up Cloudflare R2 for file uploads in your Esnaad Dashboard backend.

## Step 1: Set up Cloudflare R2

### 1.1 Create R2 Bucket

1. **Log in to Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com
   - Select your account

2. **Navigate to R2**
   - Click on "R2" in the left sidebar

3. **Create a new bucket**
   - Click "Create bucket"
   - Name: `esnaad-dashboard` (or your preferred name)
   - Location: Automatic (recommended)
   - Click "Create bucket"

### 1.2 Configure CORS for the Bucket

1. **Go to your bucket settings**
   - Click on your bucket name
   - Go to "Settings" tab
   - Click on "CORS policy"

2. **Add CORS rules**
   ```json
   [
     {
       "AllowedOrigins": [
         "http://localhost:3000",
         "http://localhost:3001",
         "https://your-production-domain.com"
       ],
       "AllowedMethods": [
         "GET",
         "PUT",
         "POST",
         "DELETE",
         "HEAD"
       ],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

### 1.3 Create R2 API Token

1. **Go to R2 > Manage R2 API Tokens**
   - Click "Create API token"

2. **Configure token permissions**
   - Token name: `esnaad-dashboard-token`
   - Permissions: Select "Object Read & Write"
   - Specify bucket: Select your bucket (`esnaad-dashboard`)
   - TTL: Leave as "Forever" or set expiry as needed
   - Click "Create API Token"

3. **Save credentials** (⚠️ You'll only see these once!)
   ```
   Access Key ID: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Secret Access Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Endpoint: https://<account_id>.r2.cloudflarestorage.com
   ```

### 1.4 Set up Public Access (Optional)

If you want files to be publicly accessible:

1. **Go to bucket settings > Public access**
2. **Configure custom domain** (recommended) or use R2.dev subdomain
   - For R2.dev: Enable "R2.dev subdomain"
   - Note your public URL: `https://pub-xxxxx.r2.dev`

## Step 2: Configure Environment Variables

### 2.1 Update your `.env` file

```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_access_key_from_step_1.3
R2_SECRET_ACCESS_KEY=your_secret_key_from_step_1.3
R2_BUCKET_NAME=esnaad-dashboard
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev  # Or your custom domain
```

### 2.2 Finding your Account ID

1. Go to Cloudflare Dashboard
2. Right sidebar shows "Account ID"
3. Copy this value for `R2_ACCOUNT_ID`

### 2.3 Example `.env` configuration

```env
# Cloudflare R2
R2_ACCOUNT_ID=a1b2c3d4e5f6g7h8i9j0
R2_ACCESS_KEY_ID=f4d3c2b1a0z9y8x7w6v5
R2_SECRET_ACCESS_KEY=u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4
R2_BUCKET_NAME=esnaad-dashboard
R2_PUBLIC_URL=https://pub-a1b2c3d4e5f6.r2.dev
```

## Step 3: Test the Integration

### 3.1 Restart your backend server

```bash
npm run dev
```

You should see in the logs that R2 is configured (no warning message).

### 3.2 Test with cURL

1. **Get a presigned URL**:
```bash
# First, get your auth token
TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}' \
  | jq -r '.data.accessToken')

# Request presigned URL
curl -X POST http://localhost:8080/api/uploads/r2/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "fileName": "test-image.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 100000
      }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "uploads": [
      {
        "presignedUrl": "https://esnaad-dashboard.a1b2c3.r2.cloudflarestorage.com/...",
        "publicUrl": "https://pub-xxxxx.r2.dev/snagging/userId/timestamp_id.jpg",
        "key": "snagging/userId/timestamp_id.jpg",
        "expiresIn": 3600
      }
    ]
  }
}
```

2. **Upload a file using the presigned URL**:
```bash
# Upload actual file
curl -X PUT "PRESIGNED_URL_FROM_ABOVE" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/path/to/your/image.jpg
```

3. **Verify the upload**:
   - Visit the `publicUrl` in your browser
   - The image should be accessible

## Step 4: Integration with Handover Module

The existing R2 service supports the Handover module. To use it:

### 4.1 For Handover Attachments

```javascript
// 1. Get presigned URL from your endpoint
const response = await fetch('/api/uploads/r2/presign', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    files: [{
      fileName: 'unit-photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: file.size
    }]
  })
});

const { uploads } = await response.json();
const { presignedUrl, publicUrl, key } = uploads[0];

// 2. Upload file directly to R2
await fetch(presignedUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type
  }
});

// 3. Save the publicUrl and key in handover attachment
const handoverAttachment = {
  url: publicUrl,
  key: key,
  mimeType: file.type,
  sizeBytes: file.size,
  caption: 'Unit living room'
};
```

### 4.2 Update the upload service path (if needed)

The current service uses `snagging/` prefix for uploads. To support handovers, you might want to update the service to accept a path prefix:

```typescript
// In r2-upload.service.ts, modify the key generation:
const prefix = params.prefix || 'snagging';  // Add prefix parameter
const key = `${prefix}/${params.userId}/${timestamp}_${uniqueId}.${fileExtension}`;
```

## Step 5: Production Considerations

### 5.1 Security
- [ ] Never commit R2 credentials to git
- [ ] Use different buckets for dev/staging/production
- [ ] Implement file size limits (currently 10MB)
- [ ] Validate file types on backend
- [ ] Consider virus scanning for uploads

### 5.2 Performance
- [ ] Use CDN custom domain for better performance
- [ ] Implement image optimization (resize, compress)
- [ ] Consider using Workers for image transformation
- [ ] Set appropriate cache headers

### 5.3 Costs
- **Storage**: $0.015 per GB per month
- **Class A operations** (writes): $0.0045 per 1,000 requests
- **Class B operations** (reads): $0.0009 per 1,000 requests
- **Egress**: Free (unlike S3!)

### 5.4 Monitoring
- Set up alerts for failed uploads
- Monitor storage usage
- Track upload/download metrics
- Log errors for debugging

## Step 6: Troubleshooting

### Common Issues

1. **"R2 upload service disabled" warning**
   - Check all R2 environment variables are set
   - Verify credentials are correct

2. **CORS errors when uploading**
   - Update bucket CORS policy
   - Include your frontend URL in AllowedOrigins

3. **403 Forbidden on presigned URL**
   - Check API token permissions
   - Verify bucket name matches
   - Ensure token hasn't expired

4. **Files not publicly accessible**
   - Enable public access on bucket
   - Configure R2.dev subdomain or custom domain
   - Check public URL format

## Example: Complete Upload Flow Test

```javascript
// test-r2-upload.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testR2Upload() {
  const API_URL = 'http://localhost:8080/api';

  // 1. Login
  const loginRes = await axios.post(`${API_URL}/auth/login`, {
    email: 'admin@example.com',
    password: 'Admin123!'
  });
  const token = loginRes.data.data.accessToken;

  // 2. Get presigned URL
  const presignRes = await axios.post(
    `${API_URL}/uploads/r2/presign`,
    {
      files: [{
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000
      }]
    },
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  const upload = presignRes.data.data.uploads[0];
  console.log('Presigned URL received:', upload);

  // 3. Upload file (create a test file or use existing)
  const fileBuffer = Buffer.from('test image data');
  await axios.put(upload.presignedUrl, fileBuffer, {
    headers: { 'Content-Type': 'image/jpeg' }
  });

  console.log('File uploaded successfully!');
  console.log('Public URL:', upload.publicUrl);
}

testR2Upload().catch(console.error);
```

Run with: `node test-r2-upload.js`

## Next Steps

Once R2 is working:
1. ✅ Test file uploads through the API
2. ✅ Integrate with Handover module attachments
3. ✅ Update frontend to use presigned URLs
4. ✅ Set up lifecycle rules for old files
5. ✅ Configure backup strategy