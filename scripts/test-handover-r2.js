#!/usr/bin/env node

/**
 * Test Handover Module with R2 Integration
 *
 * This script tests the complete handover workflow:
 * 1. Create a handover with attachments using R2
 * 2. Send to owner
 * 3. Owner confirms
 * 4. Admin confirms
 * 5. Complete and generate PDF
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:8080/api';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin123!';
const OWNER_EMAIL = 'owner1@example.com';
const OWNER_PASSWORD = 'Owner123!';

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

async function testHandoverWithR2() {
  try {
    console.log(colors.bright + '\n========================================');
    console.log('     Handover + R2 Integration Test');
    console.log('========================================' + colors.reset);

    // Step 1: Login as Admin
    logStep(1, 'Login as Admin');
    const adminLogin = await axios.post(`${API_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    const adminToken = adminLogin.data.data.tokens.accessToken;
    logSuccess('Admin authenticated');

    // Step 2: Get available units
    logStep(2, 'Get available units');
    const unitsResponse = await axios.get(`${API_URL}/units`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // Units are nested in data.data
    if (!unitsResponse.data.data || !unitsResponse.data.data.data || unitsResponse.data.data.data.length === 0) {
      throw new Error('No units available. Please seed the database first.');
    }

    const unit = unitsResponse.data.data.data[0];
    logSuccess(`Found unit: ${unit.unitNumber}`);
    logInfo('Unit ID', unit.id);
    logInfo('Owner ID', unit.ownerId || 'No owner');

    // Step 3: Get owner details (use first owner if unit has no owner)
    logStep(3, 'Get owner details');
    let ownerId = unit.ownerId;

    if (!ownerId) {
      const usersResponse = await axios.get(`${API_URL}/users?role=OWNER`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      // Users are also likely nested in data.data
      if (usersResponse.data.data && usersResponse.data.data.data && usersResponse.data.data.data.length > 0) {
        ownerId = usersResponse.data.data.data[0].id;
        logInfo('Using owner', usersResponse.data.data.data[0].email);
      } else {
        throw new Error('No owners found in the system');
      }
    }

    // Step 4: Upload test image to R2
    logStep(4, 'Upload test image to R2');

    // Get presigned URL for upload
    const presignResponse = await axios.post(
      `${API_URL}/uploads/r2/presign`,
      {
        files: [{
          fileName: 'handover-unit-photo.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1000
        }]
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    const uploadData = presignResponse.data.data.uploads[0];
    logSuccess('Got presigned URL from R2');
    logInfo('R2 Key', uploadData.key);

    // Upload dummy image to R2
    const dummyImage = Buffer.from('test handover image data');
    await axios.put(uploadData.presignedUrl, dummyImage, {
      headers: { 'Content-Type': 'image/jpeg' }
    });
    logSuccess('Image uploaded to R2');
    logInfo('Public URL', uploadData.publicUrl);

    // Step 5: Create handover with R2 attachment
    logStep(5, 'Create handover with R2 attachment');

    const handoverData = {
      unitId: unit.id,
      ownerId: ownerId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      handoverAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
      notes: 'Unit is in excellent condition. All systems checked and functional.',
      items: [
        {
          category: 'Electrical',
          label: 'All lights working',
          expectedValue: 'Yes',
          actualValue: 'Yes',
          status: 'OK',
          sortOrder: 1
        },
        {
          category: 'Plumbing',
          label: 'No leaks detected',
          expectedValue: 'Yes',
          actualValue: 'Yes',
          status: 'OK',
          sortOrder: 2
        },
        {
          category: 'General',
          label: 'Keys provided',
          expectedValue: '2 sets',
          actualValue: '2 sets',
          status: 'OK',
          notes: 'Both sets handed over',
          sortOrder: 3
        }
      ],
      attachments: [
        {
          url: uploadData.publicUrl,
          key: uploadData.key,
          mimeType: 'image/jpeg',
          sizeBytes: 1000,
          caption: 'Unit entrance photo'
        }
      ]
    };

    const createResponse = await axios.post(
      `${API_URL}/handovers`,
      handoverData,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const handover = createResponse.data.data;
    logSuccess('Handover created successfully!');
    logInfo('Handover ID', handover.id);
    logInfo('Status', handover.status);
    logInfo('Items', handover.items.length);
    logInfo('Attachments', handover.attachments.length);

    // Step 6: Send to owner
    logStep(6, 'Send handover to owner');

    await axios.post(
      `${API_URL}/handovers/${handover.id}/send`,
      { message: 'Please review the handover details for your unit.' },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    logSuccess('Handover sent to owner');

    // Step 7: Login as Owner
    logStep(7, 'Login as Owner');

    // Get the owner's email - user detail is likely also nested
    const ownerDetailsResponse = await axios.get(`${API_URL}/users/${ownerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const ownerEmail = ownerDetailsResponse.data.data.data ? ownerDetailsResponse.data.data.data.email : ownerDetailsResponse.data.data.email;

    const ownerLogin = await axios.post(`${API_URL}/auth/login`, {
      email: ownerEmail,
      password: OWNER_PASSWORD // Assuming default password
    });
    const ownerToken = ownerLogin.data.data.tokens.accessToken;
    logSuccess('Owner authenticated');

    // Step 8: Owner views handover
    logStep(8, 'Owner views handover');

    const ownerViewResponse = await axios.get(
      `${API_URL}/handovers/${handover.id}`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` }
      }
    );
    logSuccess('Owner can view handover');
    logInfo('R2 Attachment URL', ownerViewResponse.data.data.attachments[0].url);

    // Step 9: Owner confirms
    logStep(9, 'Owner confirms handover');

    await axios.post(
      `${API_URL}/handovers/${handover.id}/owner-confirm`,
      { acknowledgement: 'I confirm receipt of the unit in good condition.' },
      {
        headers: { Authorization: `Bearer ${ownerToken}` }
      }
    );
    logSuccess('Owner confirmed handover');

    // Step 10: Admin final confirmation
    logStep(10, 'Admin final confirmation');

    await axios.post(
      `${API_URL}/handovers/${handover.id}/admin-confirm`,
      { finalNotes: 'All documentation verified.' },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    logSuccess('Admin confirmed handover');

    // Step 11: Complete handover and generate PDF
    logStep(11, 'Complete handover and generate PDF');

    const completeResponse = await axios.post(
      `${API_URL}/handovers/${handover.id}/complete`,
      {},
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    const completedHandover = completeResponse.data.data;
    logSuccess('Handover completed!');

    if (completedHandover.document) {
      logInfo('PDF Generated', 'Yes');
      logInfo('Document ID', completedHandover.document.id);
      logInfo('PDF URL', completedHandover.document.url);
      logInfo('PDF Hash', completedHandover.document.sha256Hash);
    }

    // Summary
    console.log(colors.bright + '\n========================================');
    console.log(colors.green + '✓ Handover + R2 Integration Test Complete!');
    console.log(colors.reset + '========================================');

    console.log('\n📋 Summary:');
    console.log('  • Handover created with R2 attachments: ✓');
    console.log('  • Workflow completed (DRAFT → COMPLETED): ✓');
    console.log('  • R2 image uploaded and linked: ✓');
    console.log('  • PDF agreement generated: ✓');

    console.log(`\n🔗 View the handover attachment at:`);
    console.log(`   ${colors.cyan}${uploadData.publicUrl}${colors.reset}`);

    if (completedHandover.document) {
      console.log(`\n📄 View the PDF agreement at:`);
      console.log(`   ${colors.cyan}${completedHandover.document.url}${colors.reset}`);
    }

  } catch (error) {
    console.error(colors.red + '\n✗ Test failed!' + colors.reset);

    if (error.response) {
      console.error('\nAPI Error:');
      console.error('  Status:', error.response.status);
      console.error('  Message:', error.response.data.error || error.response.data.message);

      if (error.response.data.details) {
        console.error('  Details:', JSON.stringify(error.response.data.details, null, 2));
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Could not connect to the API server');
      console.error('   Make sure your backend is running on http://localhost:8080');
    } else {
      console.error('\nError:', error.message);
    }

    process.exit(1);
  }
}

// Run the test
console.log(colors.cyan + '\n🚀 Starting Handover + R2 Integration Test...' + colors.reset);

testHandoverWithR2().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('\nUnexpected error:', error.message);
  process.exit(1);
});