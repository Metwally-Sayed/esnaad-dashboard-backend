/**
 * Puppeteer configuration
 * In Docker (Alpine), use system Chromium instead of downloading bundled Chrome
 */
module.exports = {
  skipDownload: !!process.env.PUPPETEER_SKIP_DOWNLOAD,
};
