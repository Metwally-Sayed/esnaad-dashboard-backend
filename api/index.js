// Vercel serverless function wrapper
// Use the pre-created app instance
const { app } = require('../dist/app');

// Export for Vercel
module.exports = app;