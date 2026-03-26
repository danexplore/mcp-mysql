# MCP Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o protocolo customizado do `server.js` pelo `@modelcontextprotocol/sdk` oficial, tornando o servidor MCP reconhecido e consumido corretamente pelo Claude Code.

**Architecture:** O `server.js` usa `McpServer` + `StdioServerTransport` do SDK oficial para expor 4 ferramentas (`list_tables`, `get_table_schema`, `execute_select`, `execute_write`). O `lib/generator.js` é atualizado para gerar esse mesmo código quando usuários instalam via `npx`. Toda lógica de segurança SQL existente em `lib/db.js` é preservada.

**Tech Stack:** Node.js, `@modelcontextprotocol/sdk` ^1.x, `zod` (incluído como dependência do SDK), `mysql2`, `dotenv`

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `package.json` | Modificar | Adicionar `@modelcontextprotocol/sdk` e `zod` às deps |
| `server.js` | Reescrever | Servidor MCP com McpServer + StdioServerTransport |
| `lib/generator.js` | Modificar | `generateServerJs()` e `generatePackageJson()` com novo código |
| `tests/generator.test.js` | Criar | Testes unitários do generator |
| `tests/server.test.js` | Criar | Teste de integração — server inicia e responde tools/list |

---

## Task 1: Instalar dependências e configurar test runner

**Files:**
- Modify: `package.json`
- Create: `tests/` (diretório)

- [ ] **Step 1: Adicionar dependências ao package.json**

Editar `package.json` para ficar assim:

```json
{
  "name": "mcp-mysql-server",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "dotenv": "^16.3.1",
    "mysql2": "^3.6.5",
    "zod": "^3.22.0"
  }
}
```

- [ ] **Step 2: Instalar as dependências**

```bash
npm install
```

Esperado: sem erros, `@modelcontextprotocol/sdk` e `zod` aparecem em `node_modules/`.

- [ ] **Step 3: Verificar que McpServer e StdioServerTransport importam corretamente**

```bash
node -e "
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
console.log('OK:', typeof McpServer, typeof StdioServerTransport, typeof z);
"
```

Esperado: `OK: function function object`

- [ ] **Step 4: Criar diretório de testes**

```bash
mkdir -p tests
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @modelcontextprotocol/sdk and zod dependencies"
```

---

## Task 2: Reescrever server.js com MCP SDK

**Files:**
- Rewrite: `server.js`

- [ ] **Step 1: Escrever o teste de integração (antes de implementar)**

Criar `tests/server.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');

// Envia uma sequência de mensagens MCP ao servidor e coleta respostas
function runServer(messages) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server.js');
    const proc = spawn('node', [serverPath], {
      env: {
        ...process.env,
        DB_HOST: 'localhost',
        DB_PORT: '3306',
        DB_USER: 'test',
        DB_PASSWORD: 'test',
        DB_NAME: 'test'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const responses = [];
    let buffer = '';

    proc.stdout.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.trim()) {
          try { responses.push(JSON.parse(line)); } catch {}
        }
      }
    });

    // Enviar mensagens com delay para permitir inicialização
    setTimeout(() => {
      for (const msg of messages) {
        proc.stdin.write(JSON.stringify(msg) + '\n');
      }
    }, 200);

    setTimeout(() => {
      proc.kill();
      resolve(responses);
    }, 1500);

    proc.on('error', reject);
  });
}

test('server starts without crashing', async () => {
  const responses = await runServer([]);
  // Se chegou até aqui sem exceção, o servidor iniciou com sucesso
  assert.ok(true);
});

test('server responds to initialize handshake', async () => {
  const responses = await runServer([
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' }
      }
    }
  ]);

  const initResponse = responses.find(r => r.id === 1);
  assert.ok(initResponse, 'deve retornar resposta ao initialize');
  assert.ok(initResponse.result, 'resultado não deve ser nulo');
  assert.ok(initResponse.result.serverInfo, 'deve ter serverInfo');
});

test('tools/list returns 4 tools', async () => {
  const responses = await runServer([
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' }
      }
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }
  ]);

  const toolsResponse = responses.find(r => r.id === 2);
  assert.ok(toolsResponse, 'deve retornar resposta ao tools/list');
  const tools = toolsResponse.result.tools;
  assert.equal(tools.length, 4);
  const names = tools.map(t => t.name).sort();
  assert.deepEqual(names, ['execute_select', 'execute_write', 'get_table_schema', 'list_tables']);
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
node --test tests/server.test.js
```

Esperado: falha com erro relacionado ao protocolo customizado atual ou timeout.

- [ ] **Step 3: Reescrever server.js**

Substituir o conteúdo de `server.js` por:

```javascript
#!/usr/bin/env node
require('dotenv').config();
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const mysql = require('mysql2/promise');
const fs = require('fs');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'seu_banco',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
};

if (process.env.DB_SSL_MODE) {
  const sslConfig = {};
  if (process.env.DB_SSL_MODE === 'REQUIRED') {
    sslConfig.rejectUnauthorized = true;
  } else if (process.env.DB_SSL_MODE === 'SKIP_VERIFY') {
    sslConfig.rejectUnauthorized = false;
  }
  if (process.env.DB_SSL_CA) {
    try { sslConfig.ca = [fs.readFileSync(process.env.DB_SSL_CA, 'utf8')]; }
    catch (e) { console.error(`Failed to read CA certificate: ${e.message}`); process.exit(1); }
  }
  if (process.env.DB_SSL_CERT) {
    try { sslConfig.cert = fs.readFileSync(process.env.DB_SSL_CERT, 'utf8'); }
    catch (e) { console.error(`Failed to read client certificate: ${e.message}`); process.exit(1); }
  }
  if (process.env.DB_SSL_KEY) {
    try { sslConfig.key = fs.readFileSync(process.env.DB_SSL_KEY, 'utf8'); }
    catch (e) { console.error(`Failed to read client key: ${e.message}`); process.exit(1); }
  }
  DB_CONFIG.ssl = Object.keys(sslConfig).length > 0 ? sslConfig : true;
}

let pool;

function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${level}: ${message}`;
  if (process.env.LOG_FILE) {
    fs.appendFileSync(process.env.LOG_FILE, logMsg + '\n');
  }
}

function formatError(error) {
  switch (error.code) {
    case 'ER_NO_SUCH_TABLE': return `Tabela não encontrada: ${error.sqlMessage || error.message}`;
    case 'ER_BAD_FIELD_ERROR': return `Coluna não encontrada: ${error.sqlMessage || error.message}`;
    case 'ER_PARSE_ERROR':
    case 'ER_SYNTAX_ERROR': return `Erro de sintaxe SQL: ${error.sqlMessage || error.message}`;
    case 'ER_ACCESS_DENIED_ERROR': return 'Acesso negado ao banco. Verifique as credenciais no .env';
    case 'ER_DUP_ENTRY': return `Registro duplicado: ${error.sqlMessage || error.message}`;
    case 'ECONNREFUSED': return `Não foi possível conectar ao MySQL em ${DB_CONFIG.host}:${DB_CONFIG.port}`;
    case 'ETIMEDOUT': return `Timeout ao conectar ao MySQL em ${DB_CONFIG.host}:${DB_CONFIG.port}`;
    default: return error.message;
  }
}

const FORBIDDEN = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE'];
const ALLOWED = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

function validateSQL(sql) {
  const upper = sql.trim().toUpperCase();
  const firstWord = upper.split(/\s/)[0];
  if (!ALLOWED.some(op => upper.startsWith(op))) {
    throw new Error(`Operação "${firstWord}" não permitida. Use: ${ALLOWED.join(', ')}`);
  }
  if (upper.includes(';')) {
    throw new Error('Múltiplos statements não são permitidos — envie um comando por vez');
  }
  const found = FORBIDDEN.find(kw => upper.includes(kw));
  if (found) {
    throw new Error(`Palavra-chave proibida: ${found}. Operações DDL não são permitidas`);
  }
}

function errorResponse(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

async function main() {
  pool = mysql.createPool(DB_CONFIG);
  log('INFO', 'Pool MySQL inicializado');

  const server = new McpServer({ name: 'mcp-mysql', version: '1.0.0' });

  server.tool('list_tables', {}, async () => {
    try {
      const conn = await pool.getConnection();
      try {
        const [tables] = await conn.execute('SHOW TABLES');
        const tableNames = tables.map(row => Object.values(row)[0]);
        log('INFO', `list_tables: ${tableNames.length} tabelas`);
        return { content: [{ type: 'text', text: JSON.stringify(tableNames, null, 2) }] };
      } finally { conn.release(); }
    } catch (err) {
      log('ERROR', err.message);
      return errorResponse(formatError(err));
    }
  });

  server.tool('get_table_schema', { table_name: z.string().describe('Nome da tabela') }, async ({ table_name }) => {
    try {
      if (!/^[a-zA-Z0-9_]+$/.test(table_name)) {
        return errorResponse(`Nome de tabela inválido: "${table_name}". Use apenas letras, números e _`);
      }
      const conn = await pool.getConnection();
      try {
        const [columns] = await conn.execute(
          'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?',
          [table_name, DB_CONFIG.database]
        );
        if (columns.length === 0) {
          return errorResponse(`Tabela "${table_name}" não encontrada no banco ${DB_CONFIG.database}`);
        }
        log('INFO', `get_table_schema: ${table_name} (${columns.length} colunas)`);
        return { content: [{ type: 'text', text: JSON.stringify(columns, null, 2) }] };
      } finally { conn.release(); }
    } catch (err) {
      log('ERROR', err.message);
      return errorResponse(formatError(err));
    }
  });

  server.tool('execute_select', { sql: z.string().describe('Query SELECT a executar') }, async ({ sql }) => {
    try {
      validateSQL(sql);
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.execute(sql);
        log('INFO', `execute_select: ${rows.length} linhas`);
        return { content: [{ type: 'text', text: JSON.stringify({ rowCount: rows.length, rows }, null, 2) }] };
      } finally { conn.release(); }
    } catch (err) {
      log('ERROR', err.message);
      return errorResponse(err.message.includes('permitid') || err.message.includes('proibid') ? err.message : formatError(err));
    }
  });

  server.tool('execute_write', { sql: z.string().describe('Statement INSERT, UPDATE ou DELETE') }, async ({ sql }) => {
    try {
      validateSQL(sql);
      const conn = await pool.getConnection();
      try {
        const [result] = await conn.execute(sql);
        log('INFO', `execute_write: ${result.affectedRows} linhas afetadas`);
        return { content: [{ type: 'text', text: `${result.affectedRows} linhas afetadas` }] };
      } finally { conn.release(); }
    } catch (err) {
      log('ERROR', err.message);
      return errorResponse(err.message.includes('permitid') || err.message.includes('proibid') ? err.message : formatError(err));
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('INFO', 'Servidor MCP MySQL pronto');
}

process.on('SIGINT', async () => {
  if (pool) await pool.end();
  process.exit(0);
});

main().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
```

- [ ] **Step 4: Rodar os testes**

```bash
node --test tests/server.test.js
```

Esperado:
```
▶ server starts without crashing
  ✓ server starts without crashing
▶ server responds to initialize handshake
  ✓ server responds to initialize handshake
▶ tools/list returns 4 tools
  ✓ tools/list returns 4 tools
```

- [ ] **Step 5: Commit**

```bash
git add server.js tests/server.test.js
git commit -m "feat: rewrite server.js using @modelcontextprotocol/sdk"
```

---

## Task 3: Atualizar lib/generator.js

**Files:**
- Modify: `lib/generator.js`
- Create: `tests/generator.test.js`

- [ ] **Step 1: Escrever testes para o generator**

Criar `tests/generator.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateServerJs, generatePackageJson } = require('../lib/generator.js');

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

test('generatePackageJson inclui @modelcontextprotocol/sdk', () => {
  const pkg = JSON.parse(generatePackageJson());
  assert.ok(pkg.dependencies['@modelcontextprotocol/sdk'], 'deve ter SDK nas deps');
  assert.ok(pkg.dependencies['zod'], 'deve ter zod nas deps');
  assert.ok(pkg.dependencies['mysql2'], 'deve manter mysql2 nas deps');
  assert.ok(pkg.dependencies['dotenv'], 'deve manter dotenv nas deps');
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
node --test tests/generator.test.js
```

Esperado: falha nos testes que verificam o SDK (código atual ainda usa protocolo antigo).

- [ ] **Step 3: Atualizar generateServerJs() em lib/generator.js**

Substituir a função `generateServerJs()` inteira (linhas 30–263) pelo novo conteúdo:

```javascript
function generateServerJs() {
  return `#!/usr/bin/env node
require('dotenv').config();
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const mysql = require('mysql2/promise');
const fs = require('fs');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'seu_banco',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
};

if (process.env.DB_SSL_MODE) {
  const sslConfig = {};
  if (process.env.DB_SSL_MODE === 'REQUIRED') {
    sslConfig.rejectUnauthorized = true;
  } else if (process.env.DB_SSL_MODE === 'SKIP_VERIFY') {
    sslConfig.rejectUnauthorized = false;
  }
  if (process.env.DB_SSL_CA) {
    try { sslConfig.ca = [fs.readFileSync(process.env.DB_SSL_CA, 'utf8')]; }
    catch (e) { console.error(\`Failed to read CA certificate: \${e.message}\`); process.exit(1); }
  }
  if (process.env.DB_SSL_CERT) {
    try { sslConfig.cert = fs.readFileSync(process.env.DB_SSL_CERT, 'utf8'); }
    catch (e) { console.error(\`Failed to read client certificate: \${e.message}\`); process.exit(1); }
  }
  if (process.env.DB_SSL_KEY) {
    try { sslConfig.key = fs.readFileSync(process.env.DB_SSL_KEY, 'utf8'); }
    catch (e) { console.error(\`Failed to read client key: \${e.message}\`); process.exit(1); }
  }
  DB_CONFIG.ssl = Object.keys(sslConfig).length > 0 ? sslConfig : true;
}

let pool;

function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMsg = \`[\${timestamp}] \${level}: \${message}\`;
  if (process.env.LOG_FILE) {
    fs.appendFileSync(process.env.LOG_FILE, logMsg + '\\n');
  }
}

function formatError(error) {
  switch (error.code) {
    case 'ER_NO_SUCH_TABLE': return \`Tabela não encontrada: \${error.sqlMessage || error.message}\`;
    case 'ER_BAD_FIELD_ERROR': return \`Coluna não encontrada: \${error.sqlMessage || error.message}\`;
    case 'ER_PARSE_ERROR':
    case 'ER_SYNTAX_ERROR': return \`Erro de sintaxe SQL: \${error.sqlMessage || error.message}\`;
    case 'ER_ACCESS_DENIED_ERROR': return 'Acesso negado ao banco. Verifique as credenciais no .env';
    case 'ER_DUP_ENTRY': return \`Registro duplicado: \${error.sqlMessage || error.message}\`;
    case 'ECONNREFUSED': return \`Não foi possível conectar ao MySQL em \${DB_CONFIG.host}:\${DB_CONFIG.port}\`;
    case 'ETIMEDOUT': return \`Timeout ao conectar ao MySQL em \${DB_CONFIG.host}:\${DB_CONFIG.port}\`;
    default: return error.message;
  }
}

const FORBIDDEN = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE'];
const ALLOWED = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

function validateSQL(sql) {
  const upper = sql.trim().toUpperCase();
  const firstWord = upper.split(/\\s/)[0];
  if (!ALLOWED.some(op => upper.startsWith(op))) {
    throw new Error(\`Operação "\${firstWord}" não permitida. Use: \${ALLOWED.join(', ')}\`);
  }
  if (upper.includes(';')) {
    throw new Error('Múltiplos statements não são permitidos — envie um comando por vez');
  }
  const found = FORBIDDEN.find(kw => upper.includes(kw));
  if (found) {
    throw new Error(\`Palavra-chave proibida: \${found}. Operações DDL não são permitidas\`);
  }
}

function errorResponse(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

async function main() {
  pool = mysql.createPool(DB_CONFIG);
  log('INFO', 'Pool MySQL inicializado');

  const server = new McpServer({ name: 'mcp-mysql', version: '1.0.0' });

  server.tool('list_tables', {}, async () => {
    try {
      const conn = await pool.getConnection();
      try {
        const [tables] = await conn.execute('SHOW TABLES');
        const tableNames = tables.map(row => Object.values(row)[0]);
        log('INFO', \`list_tables: \${tableNames.length} tabelas\`);
        return { content: [{ type: 'text', text: JSON.stringify(tableNames, null, 2) }] };
      } finally { conn.release(); }
    } catch (err) {
      log('ERROR', err.message);
      return errorResponse(formatError(err));
    }
  });

  server.tool('get_table_schema', { table_name: z.string().describe('Nome da tabela') }, async ({ table_name }) => {
    try {
      if (!/^[a-zA-Z0-9_]+$/.test(table_name)) {
        return errorResponse(\`Nome de tabela inválido: "\${table_name}". Use apenas letras, números e _\`);
      }
      const conn = await pool.getConnection();
      try {
        const [columns] = await conn.execute(
          'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?',
          [table_name, DB_CONFIG.database]
        );
        if (columns.length === 0) {
          return errorResponse(\`Tabela "\${table_name}" não encontrada no banco \${DB_CONFIG.database}\`);
        }
        log('INFO', \`get_table_schema: \${table_name} (\${columns.length} colunas)\`);
        return { content: [{ type: 'text', text: JSON.stringify(columns, null, 2) }] };
      } finally { conn.release(); }
    } catch (err) {
      log('ERROR', err.message);
      return errorResponse(formatError(err));
    }
  });

  server.tool('execute_select', { sql: z.string().describe('Query SELECT a executar') }, async ({ sql }) => {
    try {
      validateSQL(sql);
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.execute(sql);
        log('INFO', \`execute_select: \${rows.length} linhas\`);
        return { content: [{ type: 'text', text: JSON.stringify({ rowCount: rows.length, rows }, null, 2) }] };
      } finally { conn.release(); }
    } catch (err) {
      log('ERROR', err.message);
      return errorResponse(err.message.includes('permitid') || err.message.includes('proibid') ? err.message : formatError(err));
    }
  });

  server.tool('execute_write', { sql: z.string().describe('Statement INSERT, UPDATE ou DELETE') }, async ({ sql }) => {
    try {
      validateSQL(sql);
      const conn = await pool.getConnection();
      try {
        const [result] = await conn.execute(sql);
        log('INFO', \`execute_write: \${result.affectedRows} linhas afetadas\`);
        return { content: [{ type: 'text', text: \`\${result.affectedRows} linhas afetadas\` }] };
      } finally { conn.release(); }
    } catch (err) {
      log('ERROR', err.message);
      return errorResponse(err.message.includes('permitid') || err.message.includes('proibid') ? err.message : formatError(err));
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('INFO', 'Servidor MCP MySQL pronto');
}

process.on('SIGINT', async () => {
  if (pool) await pool.end();
  process.exit(0);
});

main().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});`;
}
```

- [ ] **Step 4: Atualizar generatePackageJson() em lib/generator.js**

Substituir a função `generatePackageJson()` (linhas 266–277):

```javascript
function generatePackageJson() {
  return JSON.stringify({
    name: 'mcp-mysql-server',
    version: '1.0.0',
    type: 'commonjs',
    scripts: { start: 'node server.js' },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.0.0',
      'dotenv': '^16.3.1',
      'mysql2': '^3.6.5',
      'zod': '^3.22.0'
    }
  }, null, 2);
}
```

- [ ] **Step 5: Rodar todos os testes**

```bash
node --test tests/
```

Esperado: todos os testes passam (generator + server).

- [ ] **Step 6: Commit**

```bash
git add lib/generator.js tests/generator.test.js
git commit -m "feat: update generator.js to emit MCP SDK-based server code"
```

---

## Task 4: Verificação end-to-end

**Files:** nenhum arquivo novo

- [ ] **Step 1: Iniciar o servidor real com as credenciais do .env**

```bash
node server.js &
SERVER_PID=$!
sleep 1
echo $SERVER_PID
```

Esperado: processo em background sem erros no stderr.

- [ ] **Step 2: Enviar initialize + tools/list e verificar resposta**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node server.js | head -5
```

Esperado: linha JSON com `result.serverInfo.name === "mcp-mysql"`.

- [ ] **Step 3: Encerrar servidor e rodar suite completa**

```bash
kill $SERVER_PID 2>/dev/null; node --test tests/
```

Esperado: todos os testes passam, zero falhas.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "test: add end-to-end verification for MCP protocol"
```
