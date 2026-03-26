const os = require('os');
const path = require('path');
const fs = require('fs');

function getMcpConfigPath() {
  return path.join(os.homedir(), '.claude', 'claude.json');
}


function readMcpConfig() {
  const configPath = getMcpConfigPath();
  if (!fs.existsSync(configPath)) return { mcpServers: {} };
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { mcpServers: {} };
  }
}

function mcpEntryExists() {
  const config = readMcpConfig();
  return !!(config.mcpServers && config.mcpServers.mysql);
}

function writeMcpConfig(dbConfig) {
  const configPath = getMcpConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const config = readMcpConfig();
  if (!config.mcpServers) config.mcpServers = {};

  const env = {
    DB_HOST: dbConfig.host,
    DB_PORT: String(dbConfig.port || 3306),
    DB_USER: dbConfig.user,
    DB_PASSWORD: dbConfig.password || '',
    DB_NAME: dbConfig.database
  };

  if (dbConfig.ssl && dbConfig.ssl.enable) {
    env.DB_SSL_MODE = dbConfig.ssl.mode || 'REQUIRED';
    if (dbConfig.ssl.caPath) env.DB_SSL_CA = dbConfig.ssl.caPath;
    if (dbConfig.ssl.certPath) env.DB_SSL_CERT = dbConfig.ssl.certPath;
    if (dbConfig.ssl.keyPath) env.DB_SSL_KEY = dbConfig.ssl.keyPath;
  }

  config.mcpServers.mysql = {
    command: 'npx',
    args: ['-y', '@danexplore/mcp-mysql'],
    env
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

module.exports = { readMcpConfig, writeMcpConfig, mcpEntryExists };
