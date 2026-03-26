const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

// resolveDir tests — no mocking needed
test('resolveDir sem argumento retorna ~/mcp-mysql', () => {
  const { resolveDir } = require('../lib/config');
  const expected = path.join(os.homedir(), 'mcp-mysql');
  assert.equal(resolveDir(), expected);
});

test('resolveDir com caminho absoluto retorna o mesmo caminho', () => {
  const { resolveDir } = require('../lib/config');
  const absPath = path.join(os.homedir(), 'custom');
  assert.equal(resolveDir(absPath), absPath);
});

test('resolveDir com caminho relativo resolve para caminho absoluto', () => {
  const { resolveDir } = require('../lib/config');
  assert.ok(path.isAbsolute(resolveDir('algum/dir')));
});

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
    writeMcpConfig('/path/to/server.js');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.deepEqual(config.mcpServers.mysql, {
      command: 'node',
      args: ['/path/to/server.js']
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
    writeMcpConfig('/path/to/server.js');
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
    writeMcpConfig('/path/to/server.js');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.deepEqual(config.mcpServers.outro, { command: 'python', args: ['server.py'] });
    assert.ok(config.mcpServers.mysql);
  } finally {
    os.homedir = original;
    delete require.cache[require.resolve('../lib/config')];
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
