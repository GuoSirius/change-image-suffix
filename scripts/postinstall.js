// npm lifecycle hook: runs after npm install/update
// Auto-registers Windows context menu on global install
const os = require('os');
const { execSync } = require('child_process');
const path = require('path');

if (os.platform() === 'win32' && process.env.npm_config_global === 'true') {
  try {
    const indexJs = path.join(__dirname, '..', 'dist', 'index.js');
    execSync(`node "${indexJs}" install-menu`, { stdio: 'inherit' });
  } catch (e) {
    console.warn('⚠️  Context menu auto-register failed. Run "cis install-menu" manually.');
  }
}
