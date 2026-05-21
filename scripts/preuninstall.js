// npm lifecycle hook: runs before npm uninstall
// Cleans up Windows context menu to avoid leftover registry entries
const os = require('os');
const { execSync } = require('child_process');
const path = require('path');

if (os.platform() === 'win32' && process.env.npm_config_global === 'true') {
  try {
    const indexJs = path.join(__dirname, '..', 'dist', 'index.js');
    execSync(`node "${indexJs}" uninstall-menu`, { stdio: 'inherit' });
  } catch (e) {
    // Ignore cleanup errors — the menu will be orphaned but harmless
  }
}
