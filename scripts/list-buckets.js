const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function listBuckets() {
  try {
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    console.log('Available R2 buckets:');
    if (response.Buckets && response.Buckets.length > 0) {
      response.Buckets.forEach(bucket => {
        console.log('  -', bucket.Name);
      });
    } else {
      console.log('  No buckets found');
    }
  } catch (error) {
    console.error('Error listing buckets:', error.message);
  }
}

listBuckets();