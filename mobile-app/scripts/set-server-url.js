// Patches capacitor.config.json's server.url using the LIBRECHAT_SERVER_URL
// environment variable. Used by CI (and can be run locally) before `cap sync`.
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'capacitor.config.json');
const serverUrl = process.env.LIBRECHAT_SERVER_URL;

if (!serverUrl) {
  console.error('LIBRECHAT_SERVER_URL is not set. Skipping config patch.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.server = config.server || {};
config.server.url = serverUrl;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`capacitor.config.json server.url set to: ${serverUrl}`);
