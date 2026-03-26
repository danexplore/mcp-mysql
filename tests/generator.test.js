const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { generateEnv, generateServerJs, generatePackageJson, generateFiles } = require('../lib/generator.js');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'secret',
  database: 'mydb'
};

const installDir = path.join(os.tmpdir(), 'mcp-gen-static-test');

// generateEnv tests
test('generateEnv inclui todas as variáveis de DB', () => {
  const env = generateEnv(dbConfig, installDir);
  assert.ok(env.includes('DB_HOST=localhost'));
  assert.ok(env.includes('DB_PORT=3306'));
  assert.ok(env.includes('DB_USER=root'));
  assert.ok(env.includes('DB_PASSWORD=secret'));
  assert.ok(env.includes('DB_NAME=mydb'));
});

test('generateEnv LOG_FILE contém o caminho real sem ${dir} literal', () => {
  const env = generateEnv(dbConfig, installDir);
  assert.ok(env.includes('LOG_FILE='));
  assert.ok(!env.includes('${dir}'));
  assert.ok(!env.includes('${installDir}'));
  assert.ok(env.includes(installDir));
});

// generateServerJs tests
test('generateServerJs retorna string não-vazia', () => {
  const code = generateServerJs();
  assert.ok(typeof code === 'string' && code.length > 0);
});

test('generateServerJs usa McpServer do SDK oficial', () => {
  const code = generateServerJs();
  assert.ok(code.includes('@modelcontextprotocol/sdk/server/mcp.js'), 'deve importar mcp.js');
  assert.ok(code.includes('McpServer'), 'deve usar McpServer');
});

test('generateServerJs usa StdioServerTransport', () => {
  const code = generateServerJs();
  assert.ok(code.includes('@modelcontextprotocol/sdk/server/stdio.js'), 'deve importar stdio.js');
  assert.ok(code.includes('StdioServerTransport'), 'deve usar StdioServerTransport');
});

test('generateServerJs registra as 4 ferramentas', () => {
  const code = generateServerJs();
  assert.ok(code.includes("'list_tables'"), 'deve registrar list_tables');
  assert.ok(code.includes("'get_table_schema'"), 'deve registrar get_table_schema');
  assert.ok(code.includes("'execute_select'"), 'deve registrar execute_select');
  assert.ok(code.includes("'execute_write'"), 'deve registrar execute_write');
});

test('generateServerJs não usa protocolo customizado antigo', () => {
  const code = generateServerJs();
  assert.ok(!code.includes("type: 'tool_use'"), 'não deve usar tipo tool_use antigo');
  assert.ok(!code.includes("type: 'tool_result'"), 'não deve usar tipo tool_result antigo');
  assert.ok(!code.includes('process.stdin.on'), 'não deve escutar stdin manualmente');
});

// generatePackageJson tests
test('generatePackageJson é JSON válido', () => {
  assert.doesNotThrow(() => JSON.parse(generatePackageJson()));
});

test('generatePackageJson inclui @modelcontextprotocol/sdk', () => {
  const pkg = JSON.parse(generatePackageJson());
  assert.ok(pkg.dependencies['@modelcontextprotocol/sdk'], 'deve ter SDK nas deps');
  assert.ok(pkg.dependencies['zod'], 'deve ter zod nas deps');
  assert.ok(pkg.dependencies['mysql2'], 'deve manter mysql2 nas deps');
  assert.ok(pkg.dependencies['dotenv'], 'deve manter dotenv nas deps');
});

// generateFiles tests
test('generateFiles cria .env, server.js e package.json no diretório', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-gen-files-test-' + Date.now());
  try {
    const result = generateFiles(dbConfig, tmpDir);
    assert.ok(fs.existsSync(path.join(tmpDir, '.env')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'server.js')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'package.json')));
    assert.equal(result.serverJsPath, path.join(tmpDir, 'server.js'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generateFiles .env gerado não contém ${dir} literal', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-gen-files-test-' + Date.now());
  try {
    generateFiles(dbConfig, tmpDir);
    const env = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
    assert.ok(!env.includes('${dir}'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
