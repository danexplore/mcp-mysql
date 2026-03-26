const os = require('os');
const path = require('path');
const fs = require('fs');

function getMcpConfigPath() {
  return path.join(os.homedir(), '.claude', 'claude.json');
}

function resolveDir(userChoice) {
  if (!userChoice) return path.join(os.homedir(), 'mcp-mysql');
  if (path.isAbsolute(userChoice)) return userChoice;
  return path.resolve(userChoice);
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

function writeMcpConfig(serverJsPath) {
  const configPath = getMcpConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const config = readMcpConfig();
  if (!config.mcpServers) config.mcpServers = {};
  config.mcpServers.mysql = {
    command: 'node',
    args: [serverJsPath]
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

module.exports = { resolveDir, readMcpConfig, writeMcpConfig, mcpEntryExists };
