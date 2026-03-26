const os = require('os');
const path = require('path');
const fs = require('fs');
const { resolveDir, readMcpConfig, writeMcpConfig, mcpEntryExists } = require('../lib/config');

describe('resolveDir', () => {
  test('sem argumento retorna ~/mcp-mysql', () => {
    const expected = path.join(os.homedir(), 'mcp-mysql');
    expect(resolveDir()).toBe(expected);
  });

  test('com caminho absoluto retorna o mesmo caminho', () => {
    const absPath = path.join(os.homedir(), 'custom');
    expect(resolveDir(absPath)).toBe(absPath);
  });

  test('com caminho relativo resolve para caminho absoluto', () => {
    expect(path.isAbsolute(resolveDir('algum/dir'))).toBe(true);
  });
});

describe('readMcpConfig / writeMcpConfig / mcpEntryExists', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-config-test-' + Date.now());
  const configPath = path.join(tmpDir, '.claude', 'claude.json');

  beforeEach(() => {
    jest.spyOn(os, 'homedir').mockReturnValue(tmpDir);
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('readMcpConfig retorna { mcpServers: {} } quando arquivo não existe', () => {
    expect(readMcpConfig()).toEqual({ mcpServers: {} });
  });

  test('mcpEntryExists retorna false quando não há entrada mysql', () => {
    expect(mcpEntryExists()).toBe(false);
  });

  test('writeMcpConfig cria o arquivo e adiciona entrada mysql', () => {
    writeMcpConfig('/path/to/server.js');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.mcpServers.mysql).toEqual({
      command: 'node',
      args: ['/path/to/server.js']
    });
  });

  test('mcpEntryExists retorna true após writeMcpConfig', () => {
    writeMcpConfig('/path/to/server.js');
    expect(mcpEntryExists()).toBe(true);
  });

  test('writeMcpConfig preserva outras entradas existentes em mcpServers', () => {
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({
      mcpServers: { outro: { command: 'python', args: ['server.py'] } }
    }));
    writeMcpConfig('/path/to/server.js');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.mcpServers.outro).toEqual({ command: 'python', args: ['server.py'] });
    expect(config.mcpServers.mysql).toBeDefined();
  });
});
