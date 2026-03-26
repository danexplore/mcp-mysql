const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

// MCP config tests — use a real temp dir by monkey-patching os.homedir
test('readMcpConfig retorna { mcpServers: {} } quando arquivo não existe', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-config-test-' + Date.now() + '-a');
  const original = os.homedir;
  os.homedir = () => tmpDir;
  try {
    // Clear require cache so config.js picks up patched os.homedir
    delete require.cache[require.resolve('../lib/config')];
    const { readMcpConfig } = require('../lib/config');
    assert.deepEqual(readMcpConfig(), { mcpServers: {} });
  } finally {
    os.homedir = original;
    delete require.cache[require.resolve('../lib/config')];
  }
});

test('mcpEntryExists retorna false quando não há entrada mysql', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-config-test-' + Date.now() + '-b');
  const original = os.homedir;
  os.homedir = () => tmpDir;
  try {
    delete require.cache[require.resolve('../lib/config')];
    const { mcpEntryExists } = require('../lib/config');
    assert.equal(mcpEntryExists(), false);
  } finally {
    os.homedir = original;
    delete require.cache[require.resolve('../lib/config')];
  }
});

test('writeMcpConfig cria o arquivo e adiciona entrada mysql', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-config-test-' + Date.now() + '-c');
  const configPath = path.join(tmpDir, '.claude', 'claude.json');
  const original = os.homedir;
  os.homedir = () => tmpDir;
  try {
    delete require.cache[require.resolve('../lib/config')];
    const { writeMcpConfig } = require('../lib/config');
    const dbConfig = { host: 'localhost', port: 3306, user: 'root', password: '', database: 'test' };
    writeMcpConfig(dbConfig);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.deepEqual(config.mcpServers.mysql, {
      command: 'npx',
      args: ['-y', '@danexplore/mcp-mysql'],
      env: {
        DB_HOST: 'localhost',
        DB_PORT: '3306',
        DB_USER: 'root',
        DB_PASSWORD: '',
        DB_NAME: 'test'
      }
    });
  } finally {
    os.homedir = original;
    delete require.cache[require.resolve('../lib/config')];
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('mcpEntryExists retorna true após writeMcpConfig', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-config-test-' + Date.now() + '-d');
  const original = os.homedir;
  os.homedir = () => tmpDir;
  try {
    delete require.cache[require.resolve('../lib/config')];
    const { writeMcpConfig, mcpEntryExists } = require('../lib/config');
    const dbConfig = { host: 'localhost', port: 3306, user: 'root', password: '', database: 'test' };
    writeMcpConfig(dbConfig);
    assert.equal(mcpEntryExists(), true);
  } finally {
    os.homedir = original;
    delete require.cache[require.resolve('../lib/config')];
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('writeMcpConfig preserva outras entradas existentes em mcpServers', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-config-test-' + Date.now() + '-e');
  const configPath = path.join(tmpDir, '.claude', 'claude.json');
  const original = os.homedir;
  os.homedir = () => tmpDir;
  try {
    delete require.cache[require.resolve('../lib/config')];
    const { writeMcpConfig } = require('../lib/config');
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({
      mcpServers: { outro: { command: 'python', args: ['server.py'] } }
    }));
    const dbConfig = { host: 'localhost', port: 3306, user: 'root', password: '', database: 'test' };
    writeMcpConfig(dbConfig);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.deepEqual(config.mcpServers.outro, { command: 'python', args: ['server.py'] });
    assert.ok(config.mcpServers.mysql);
  } finally {
    os.homedir = original;
    delete require.cache[require.resolve('../lib/config')];
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
