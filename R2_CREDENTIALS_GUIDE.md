# How to Get Cloudflare R2 Credentials - Step by Step Guide

## Prerequisites
- A Cloudflare account (free tier is fine)
- If you don't have one, sign up at: https://dash.cloudflare.com/sign-up

---

## Step 1: Get Your R2_ACCOUNT_ID

1. **Log in to Cloudflare**
   - Go to: https://dash.cloudflare.com

2. **Find your Account ID**
   - Look at the right sidebar of the dashboard
   - You'll see "Account ID" with a value like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
   - Click the copy button next to it
   - This is your `R2_ACCOUNT_ID`

   ![Account ID Location](https://developers.cloudflare.com/assets/images/account-id-location.png)

   ```env
   R2_ACCOUNT_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```

---

## Step 2: Create an R2 Bucket

1. **Navigate to R2**
   - In the Cloudflare dashboard, click "R2" in the left sidebar
   - If you don't see R2, you may need to enable it first (it's free to start)

2. **Create a new bucket**
   - Click "Create bucket" button
   - **Bucket name**: `esnaad-dashboard` (or `units-media` as in your .env)
   - **Location**: Select "Automatic" (recommended)
   - Click "Create bucket"

   ```env
   R2_BUCKET_NAME=esnaad-dashboard
   ```

---

## Step 3: Get R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY

### 3.1 Navigate to R2 API Tokens

1. In the R2 dashboard, look for **"Manage R2 API tokens"** link
   - OR go directly to: https://dash.cloudflare.com/?to=/:account/r2/api-tokens

### 3.2 Create a New API Token

1. **Click "Create API token"**

2. **Configure the token:**

   **Token name**:
   ```
   esnaad-dashboard-token
   ```

   **Permissions**:
   - Select: **Object Read & Write** ✅
   - (This allows both reading and writing files)

   **Specify bucket (IMPORTANT)**:
   - Select: **Apply to specific buckets only**
   - Choose your bucket: `esnaad-dashboard` or `units-media`

   **TTL (Time to Live)**:
   - Select: **Forever** (recommended for production)
   - OR set an expiry date if you prefer

   **IP Address Filtering** (Optional):
   - Leave empty for now
   - Can add your server's IP later for extra security

3. **Click "Create API Token"**

### 3.3 Save Your Credentials (⚠️ IMPORTANT - SHOWN ONLY ONCE!)

After clicking create, you'll see:

```
Access Key ID: f4d3c2b1a0z9y8x7w6v5u4t3s2r1q0p9
Secret Access Key: o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4z3y2x1w0v9u8t7s6r5q4p3o2n1
```

**⚠️ COPY THESE IMMEDIATELY! They won't be shown again!**

```env
R2_ACCESS_KEY_ID=f4d3c2b1a0z9y8x7w6v5u4t3s2r1q0p9
R2_SECRET_ACCESS_KEY=o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4z3y2x1w0v9u8t7s6r5q4p3o2n1
```

---

## Step 4: Get Your R2_PUBLIC_URL

### Option A: Using R2.dev Subdomain (Easiest - Recommended for Development)

1. **Go to your bucket**
   - Click on your bucket name in R2 dashboard

2. **Go to Settings tab**

3. **Enable R2.dev subdomain**
   - Under "Public access"
   - Toggle ON "R2.dev subdomain"
   - You'll get a URL like: `https://pub-a1b2c3d4e5f6g7h8i9j0.r2.dev`

   ```env
   R2_PUBLIC_URL=https://pub-a1b2c3d4e5f6g7h8i9j0.r2.dev
   ```

### Option B: Custom Domain (For Production)

1. **Add a custom domain**
   - In bucket settings → "Custom Domains"
   - Add your domain: `cdn.yourdomain.com`
   - Follow Cloudflare's DNS setup instructions

   ```env
   R2_PUBLIC_URL=https://cdn.yourdomain.com
   ```

---

## Step 5: Configure Bucket CORS (Important!)

1. **In your bucket, go to Settings → CORS Policy**

2. **Add this CORS configuration:**

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8080"
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

3. **Click "Save"**

---

## Complete .env Configuration

After following all steps, your `.env` should have:

```env
# Cloudflare R2
R2_ACCOUNT_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
R2_ACCESS_KEY_ID=f4d3c2b1a0z9y8x7w6v5u4t3s2r1q0p9
R2_SECRET_ACCESS_KEY=o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4z3y2x1w0v9u8t7s6r5q4p3o2n1
R2_BUCKET_NAME=esnaad-dashboard
R2_PUBLIC_URL=https://pub-a1b2c3d4e5f6g7h8i9j0.r2.dev
```

---

## Quick Verification Steps

1. **Restart your backend**
   ```bash
   npm run dev
   ```

2. **Check console output**
   - Should NOT see: "⚠️ R2 upload service disabled"
   - If you see this warning, double-check your credentials

3. **Run the test script**
   ```bash
   node scripts/test-r2-upload.js
   ```

---

## Troubleshooting

### "R2 upload service disabled" warning
- Missing one or more R2 environment variables
- Check spelling of variable names
- Make sure no extra spaces in values

### "Invalid credentials" error
- Double-check Access Key ID and Secret Access Key
- Make sure you selected the correct bucket when creating token
- Token might have expired (if you set TTL)

### "Bucket not found" error
- Verify R2_BUCKET_NAME matches your actual bucket name
- Check token has permissions for that specific bucket

### CORS errors when uploading
- Make sure you saved the CORS configuration in bucket settings
- Add your frontend URL to AllowedOrigins

### Files upload but aren't publicly accessible
- Enable R2.dev subdomain in bucket settings
- OR configure a custom domain
- Check R2_PUBLIC_URL is correct

---

## Security Best Practices

1. **Never commit credentials to Git**
   - Add `.env` to `.gitignore`
   - Use environment variables in production

2. **Use separate buckets for environments**
   - `esnaad-dev` for development
   - `esnaad-staging` for staging
   - `esnaad-prod` for production

3. **Restrict token permissions**
   - Only give necessary permissions
   - Use IP filtering in production
   - Set token expiry when possible

4. **Monitor usage**
   - Check R2 analytics regularly
   - Set up alerts for unusual activity
   - Review access logs

---

## Need Help?

- **Cloudflare R2 Documentation**: https://developers.cloudflare.com/r2/
- **R2 Pricing**: https://developers.cloudflare.com/r2/pricing/
- **Support**: https://community.cloudflare.com/c/developers/r2/

---

## Common Issues and Solutions

### Issue: "Cannot find R2 in my dashboard"
**Solution**: R2 might need to be enabled first
1. Go to https://dash.cloudflare.com/
2. Look for "R2" in the sidebar
3. If not there, go to "Billing" and enable R2 (free tier available)

### Issue: "Create API Token button is disabled"
**Solution**: You need to create a bucket first
1. Create at least one bucket
2. Then create the API token

### Issue: Lost my Secret Access Key
**Solution**: You'll need to create a new token
1. Delete the old token (if you saved the token ID)
2. Create a new token with same settings
3. Update your .env with new credentials