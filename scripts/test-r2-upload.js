#!/usr/bin/env node

/**
 * R2 Upload Test Script
 *
 * This script tests the R2 upload functionality:
 * 1. Authenticates with the API
 * 2. Requests a presigned upload URL
 * 3. Uploads a test file
 * 4. Verifies the upload
 *
 * Usage: node scripts/test-r2-upload.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:8080/api';
const TEST_IMAGE_PATH = process.argv[2]; // Optional: provide actual image path
const TEST_EMAIL = 'admin@example.com';
const TEST_PASSWORD = 'Admin123!';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.bright}${colors.blue}[Step ${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function logError(message) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

function logInfo(key, value) {
  console.log(`  ${colors.cyan}${key}:${colors.reset} ${value}`);
}

async function testR2Upload() {
  try {
    console.log(colors.bright + '\n========================================');
    console.log('     R2 Upload Integration Test');
    console.log('========================================' + colors.reset);

    // Step 1: Login
    logStep(1, 'Authenticating with the API');
    let token;
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

      if (loginResponse.data.success && loginResponse.data.data.accessToken) {
        token = loginResponse.data.data.accessToken;
        logSuccess('Authentication successful');
        logInfo('User', TEST_EMAIL);
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error) {
      logError('Authentication failed');
      if (error.response?.data?.error) {
        logError(`Error: ${error.response.data.error}`);
      }
      throw error;
    }

    // Step 2: Prepare test file
    logStep(2, 'Preparing test file');

    let fileBuffer;
    let fileName;
    let fileSize;
    let mimeType;

    if (TEST_IMAGE_PATH && fs.existsSync(TEST_IMAGE_PATH)) {
      // Use provided image
      fileBuffer = fs.readFileSync(TEST_IMAGE_PATH);
      fileName = path.basename(TEST_IMAGE_PATH);
      fileSize = fileBuffer.length;

      const ext = path.extname(TEST_IMAGE_PATH).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      mimeType = mimeTypes[ext] || 'image/jpeg';

      logSuccess(`Using provided image: ${fileName}`);
      logInfo('Size', `${(fileSize / 1024).toFixed(2)} KB`);
    } else {
      // Create dummy test image
      fileName = `test-image-${Date.now()}.jpg`;
      fileSize = 50000; // 50KB dummy file
      mimeType = 'image/jpeg';

      // Create a simple JPEG header (this is a minimal valid JPEG)
      const jpegHeader = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
        0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43
      ]);

      // Create buffer with JPEG header and dummy data
      fileBuffer = Buffer.concat([
        jpegHeader,
        Buffer.alloc(fileSize - jpegHeader.length - 2, 0),
        Buffer.from([0xFF, 0xD9]) // JPEG end marker
      ]);

      logSuccess('Created dummy test image');
      logInfo('Size', `${(fileSize / 1024).toFixed(2)} KB`);
    }

    logInfo('Filename', fileName);
    logInfo('MIME type', mimeType);

    // Step 3: Request presigned URL
    logStep(3, 'Requesting presigned upload URL');

    let presignedData;
    try {
      const presignResponse = await axios.post(
        `${API_BASE_URL}/uploads/r2/presign`,
        {
          files: [{
            fileName: fileName,
            mimeType: mimeType,
            sizeBytes: fileSize
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (presignResponse.data.success) {
        presignedData = presignResponse.data.data.uploads[0];
        logSuccess('Presigned URL received');
        logInfo('Key', presignedData.key);
        logInfo('Expires in', `${presignedData.expiresIn} seconds`);

        // Check if this is a mock URL (R2 not configured)
        if (presignedData.presignedUrl === 'https://mock-upload-url.example.com') {
          log('\n⚠️  Warning: R2 is not configured. Running in mock mode.', 'yellow');
          log('   To enable R2, add credentials to your .env file:', 'yellow');
          log('   - R2_ACCOUNT_ID', 'yellow');
          log('   - R2_ACCESS_KEY_ID', 'yellow');
          log('   - R2_SECRET_ACCESS_KEY', 'yellow');
          return;
        }
      } else {
        throw new Error('Invalid presign response');
      }
    } catch (error) {
      logError('Failed to get presigned URL');
      if (error.response?.data?.error) {
        logError(`Error: ${error.response.data.error}`);
      }
      throw error;
    }

    // Step 4: Upload file to R2
    logStep(4, 'Uploading file to R2');

    try {
      await axios.put(presignedData.presignedUrl, fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileSize
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      logSuccess('File uploaded successfully to R2');
      logInfo('Public URL', presignedData.publicUrl);
    } catch (error) {
      logError('Failed to upload file to R2');
      if (error.response) {
        logError(`Status: ${error.response.status}`);
        logError(`Response: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }

    // Step 5: Verify upload
    logStep(5, 'Verifying upload');

    try {
      // Try to fetch the uploaded file
      const verifyResponse = await axios.get(presignedData.publicUrl, {
        responseType: 'arraybuffer'
      });

      if (verifyResponse.status === 200) {
        logSuccess('File is publicly accessible');
        logInfo('Content-Type', verifyResponse.headers['content-type']);
        logInfo('Content-Length', `${(verifyResponse.headers['content-length'] / 1024).toFixed(2)} KB`);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        log('⚠️  File not publicly accessible (404)', 'yellow');
        log('   This is normal if public access is not enabled on your R2 bucket', 'yellow');
        log('   The file was still uploaded successfully', 'yellow');
      } else {
        logError('Could not verify upload');
      }
    }

    // Summary
    console.log(colors.bright + '\n========================================');
    console.log(colors.green + '✓ R2 Integration Test Complete!');
    console.log(colors.reset + '========================================');

    console.log('\n📋 Summary:');
    console.log('  • Authentication: ✓');
    console.log('  • Presigned URL: ✓');
    console.log('  • File Upload: ✓');
    console.log(`\n🔗 Your file is available at:\n   ${colors.cyan}${presignedData.publicUrl}${colors.reset}`);

    console.log('\n💡 Next steps:');
    console.log('  1. Check your R2 bucket in Cloudflare dashboard');
    console.log('  2. Test with the Handover module');
    console.log('  3. Configure public access if needed');

  } catch (error) {
    console.error(colors.red + '\n✗ Test failed!' + colors.reset);
    if (!error.response && error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Could not connect to the API server');
      console.error('   Make sure your backend is running on ' + API_BASE_URL);
    }
    process.exit(1);
  }
}

// Run the test
console.log(colors.cyan + '\n🚀 Starting R2 Upload Test...' + colors.reset);

testR2Upload().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('\nUnexpected error:', error.message);
  process.exit(1);
});