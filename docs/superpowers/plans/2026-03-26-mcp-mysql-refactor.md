# MCP MySQL Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar mcp-mysql-setup extraindo lógica compartilhada para `lib/`, corrigindo 5 bugs, e adicionando auto-configuração do `~/.claude/claude.json`.

**Architecture:** Lógica de banco, geração de arquivos e configuração são extraídos para `lib/db.js`, `lib/generator.js` e `lib/config.js`. `setup.js` e `web-ui.js` ficam como camada de UI pura que delegam para `lib/`. Nenhum arquivo `lib/` importa os outros.

**Tech Stack:** Node.js 14+, CommonJS, mysql2/promise, inquirer@8, chalk@4, ora@5, express@4, jest@29 (testes)

---

## Mapa de Arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `lib/db.js` | `testConnection()` com port, `validateSQL()` |
| Criar | `lib/config.js` | `resolveDir()`, `readMcpConfig()`, `writeMcpConfig()`, `mcpEntryExists()` |
| Criar | `lib/generator.js` | `generateEnv()`, `generateServerJs()`, `generatePackageJson()`, `generateFiles()` |
| Criar | `tests/db.test.js` | Testes unitários de `validateSQL` |
| Criar | `tests/config.test.js` | Testes unitários de `resolveDir`, `readMcpConfig`, `writeMcpConfig` |
| Criar | `tests/generator.test.js` | Testes unitários de geração de conteúdo |
| Modificar | `setup.js` | Usa `lib/`, adiciona passo 6 (MCP config), remove lógica inline duplicada |
| Modificar | `web-ui.js` | Usa `lib/`, adiciona `GET /api/server-info`, remove `process.cwd()` do browser, extrai HTML para função |
| Modificar | `package.json` | Adiciona jest em devDependencies e script `test` |

---

## Task 1: Configurar Jest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Adicionar jest ao package.json**

Abra `package.json` e substitua as seções `scripts` e `devDependencies`:

```json
{
  "name": "mcp-mysql-setup",
  "version": "1.0.0",
  "description": "Setup simplificado de MCP MySQL com interface interativa",
  "main": "index.js",
  "bin": {
    "mcp-mysql-setup": "./index.js"
  },
  "type": "commonjs",
  "scripts": {
    "setup": "node index.js",
    "cli": "node setup.js",
    "web": "node web-ui.js",
    "test": "jest"
  },
  "keywords": ["mcp", "mysql", "claude", "setup"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "mysql2": "^3.6.5",
    "inquirer": "^8.2.5",
    "chalk": "^4.1.2",
    "ora": "^5.4.1",
    "dotenv": "^16.3.1",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

- [ ] **Step 2: Instalar dependências**

```bash
npm install
```

Expected: `jest` aparece em `node_modules/.bin/jest`.

- [ ] **Step 3: Criar diretórios**

```bash
mkdir lib && mkdir tests
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jest for unit testing"
```

---

## Task 2: Criar lib/db.js

**Files:**
- Create: `lib/db.js`
- Create: `tests/db.test.js`

- [ ] **Step 1: Escrever o teste (falha esperada)**

Crie `tests/db.test.js`:

```js
const { validateSQL } = require('../lib/db');

describe('validateSQL', () => {
  test('permite SELECT', () => {
    expect(() => validateSQL('SELECT * FROM users')).not.toThrow();
  });

  test('permite INSERT', () => {
    expect(() => validateSQL('INSERT INTO users (name) VALUES ("test")')).not.toThrow();
  });

  test('permite UPDATE', () => {
    expect(() => validateSQL('UPDATE users SET name = "x" WHERE id = 1')).not.toThrow();
  });

  test('permite DELETE', () => {
    expect(() => validateSQL('DELETE FROM users WHERE id = 1')).not.toThrow();
  });

  test('ignora maiúsculas/minúsculas', () => {
    expect(() => validateSQL('select * from users')).not.toThrow();
  });

  test('rejeita DROP como operação inicial', () => {
    expect(() => validateSQL('DROP TABLE users')).toThrow('Operação não permitida');
  });

  test('rejeita SHOW (operação desconhecida)', () => {
    expect(() => validateSQL('SHOW TABLES')).toThrow('Operação não permitida');
  });

  test('rejeita SELECT que contém TRUNCATE', () => {
    expect(() => validateSQL('SELECT TRUNCATE(1.5, 0)')).toThrow('Operação contém palavras-chave proibidas');
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar falha**

```bash
npx jest tests/db.test.js
```

Expected: FAIL — `Cannot find module '../lib/db'`

- [ ] **Step 3: Implementar lib/db.js**

Crie `lib/db.js`:

```js
const mysql = require('mysql2/promise');

const FORBIDDEN = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE'];
const ALLOWED = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

function validateSQL(sql) {
  const upper = sql.trim().toUpperCase();
  if (!ALLOWED.some(op => upper.startsWith(op))) {
    throw new Error(`Operação não permitida. Use: ${ALLOWED.join(', ')}`);
  }
  if (FORBIDDEN.some(kw => upper.includes(kw))) {
    throw new Error('Operação contém palavras-chave proibidas');
  }
  return true;
}

async function testConnection({ host, port, user, password, database }) {
  try {
    const connection = await mysql.createConnection({
      host,
      port: parseInt(port) || 3306,
      user,
      password,
      database
    });
    await connection.end();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { validateSQL, testConnection };
```

- [ ] **Step 4: Rodar o teste para verificar aprovação**

```bash
npx jest tests/db.test.js
```

Expected: PASS — 8 testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/db.js tests/db.test.js
git commit -m "feat: create lib/db.js with validateSQL and testConnection (fixes bug #4 - port)"
```

---

## Task 3: Criar lib/config.js

**Files:**
- Create: `lib/config.js`
- Create: `tests/config.test.js`

- [ ] **Step 1: Escrever o teste (falha esperada)**

Crie `tests/config.test.js`:

```js
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
```

- [ ] **Step 2: Rodar o teste para verificar falha**

```bash
npx jest tests/config.test.js
```

Expected: FAIL — `Cannot find module '../lib/config'`

- [ ] **Step 3: Implementar lib/config.js**

Crie `lib/config.js`:

```js
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
```

- [ ] **Step 4: Rodar o teste para verificar aprovação**

```bash
npx jest tests/config.test.js
```

Expected: PASS — todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/config.js tests/config.test.js
git commit -m "feat: create lib/config.js with MCP auto-config and os.homedir() (fixes bugs #3 #1)"
```

---

## Task 4: Criar lib/generator.js

**Files:**
- Create: `lib/generator.js`
- Create: `tests/generator.test.js`

- [ ] **Step 1: Escrever o teste (falha esperada)**

Crie `tests/generator.test.js`:

```js
const path = require('path');
const os = require('os');
const fs = require('fs');
const { generateEnv, generateServerJs, generatePackageJson, generateFiles } = require('../lib/generator');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'secret',
  database: 'mydb'
};

const installDir = path.join(os.tmpdir(), 'mcp-gen-static-test');

describe('generateEnv', () => {
  test('inclui todas as variáveis de DB', () => {
    const env = generateEnv(dbConfig, installDir);
    expect(env).toContain('DB_HOST=localhost');
    expect(env).toContain('DB_PORT=3306');
    expect(env).toContain('DB_USER=root');
    expect(env).toContain('DB_PASSWORD=secret');
    expect(env).toContain('DB_NAME=mydb');
  });

  test('LOG_FILE contém o caminho real — sem ${dir} literal', () => {
    const env = generateEnv(dbConfig, installDir);
    expect(env).toContain('LOG_FILE=');
    expect(env).not.toContain('${dir}');
    expect(env).not.toContain('${installDir}');
    expect(env).toContain(installDir);
  });
});

describe('generateServerJs', () => {
  test('retorna string não vazia', () => {
    const server = generateServerJs();
    expect(typeof server).toBe('string');
    expect(server.length).toBeGreaterThan(0);
  });
});

describe('generatePackageJson', () => {
  test('é JSON válido', () => {
    expect(() => JSON.parse(generatePackageJson())).not.toThrow();
  });

  test('inclui mysql2 e dotenv como dependências', () => {
    const pkg = JSON.parse(generatePackageJson());
    expect(pkg.dependencies['mysql2']).toBeDefined();
    expect(pkg.dependencies['dotenv']).toBeDefined();
  });
});

describe('generateFiles', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-gen-files-test-' + Date.now());

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('cria .env, server.js e package.json no diretório', () => {
    const result = generateFiles(dbConfig, tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.env'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'server.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(result.serverJsPath).toBe(path.join(tmpDir, 'server.js'));
  });

  test('.env gerado não contém ${dir} literal', () => {
    generateFiles(dbConfig, tmpDir);
    const env = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
    expect(env).not.toContain('${dir}');
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar falha**

```bash
npx jest tests/generator.test.js
```

Expected: FAIL — `Cannot find module '../lib/generator'`

- [ ] **Step 3: Implementar lib/generator.js**

Crie `lib/generator.js`:

```js
const fs = require('fs');
const path = require('path');

function generateEnv(dbConfig, installDir) {
  return `DB_HOST=${dbConfig.host}
DB_PORT=${dbConfig.port}
DB_USER=${dbConfig.user}
DB_PASSWORD=${dbConfig.password}
DB_NAME=${dbConfig.database}
NODE_ENV=production
LOG_FILE=${path.join(installDir, 'mcp-mysql.log')}`;
}

function generateServerJs() {
  return `#!/usr/bin/env node
require('dotenv').config();
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

let pool;

async function initPool() {
  pool = mysql.createPool(DB_CONFIG);
}

function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMsg = \`[\${timestamp}] \${level}: \${message}\`;
  if (process.env.LOG_FILE) {
    fs.appendFileSync(process.env.LOG_FILE, logMsg + '\\n');
  }
}

const FORBIDDEN = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE'];
const ALLOWED = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

function validateSQL(sql) {
  const upper = sql.trim().toUpperCase();
  if (!ALLOWED.some(op => upper.startsWith(op))) {
    throw new Error(\`Operação não permitida. Use: \${ALLOWED.join(', ')}\`);
  }
  if (FORBIDDEN.some(kw => upper.includes(kw))) {
    throw new Error('Operação contém palavras-chave proibidas');
  }
  return true;
}

async function executeSelect(sql) {
  try {
    validateSQL(sql);
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(sql);
      log('INFO', \`SELECT: \${rows.length} linhas\`);
      return { success: true, rows, rowCount: rows.length };
    } finally {
      conn.release();
    }
  } catch (error) {
    log('ERROR', error.message);
    return { success: false, error: error.message };
  }
}

async function executeWrite(sql) {
  try {
    validateSQL(sql);
    const conn = await pool.getConnection();
    try {
      const result = await conn.execute(sql);
      log('INFO', \`WRITE: \${result[0].affectedRows} linhas afetadas\`);
      return { success: true, affectedRows: result[0].affectedRows };
    } finally {
      conn.release();
    }
  } catch (error) {
    log('ERROR', error.message);
    return { success: false, error: error.message };
  }
}

async function getTableSchema(tableName) {
  try {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error('Nome de tabela inválido');
    const conn = await pool.getConnection();
    try {
      const [columns] = await conn.execute(\`
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?
      \`, [tableName, DB_CONFIG.database]);
      return { success: true, columns };
    } finally {
      conn.release();
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function listTables() {
  try {
    const conn = await pool.getConnection();
    try {
      const [tables] = await conn.execute('SHOW TABLES');
      const tableNames = tables.map(row => Object.values(row)[0]);
      return { success: true, tables: tableNames };
    } finally {
      conn.release();
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function processToolCall(toolName, toolInput) {
  switch(toolName) {
    case 'execute_select': return await executeSelect(toolInput.sql);
    case 'execute_write': return await executeWrite(toolInput.sql);
    case 'get_table_schema': return await getTableSchema(toolInput.table_name);
    case 'list_tables': return await listTables();
    default: return { success: false, error: \`Ferramenta desconhecida: \${toolName}\` };
  }
}

async function main() {
  try {
    await initPool();
    log('INFO', 'Servidor MCP MySQL iniciado');

    process.stdin.on('data', async (chunk) => {
      try {
        const message = JSON.parse(chunk.toString());
        if (message.type === 'tool_use') {
          const result = await processToolCall(message.name, message.input || {});
          const response = {
            type: 'tool_result',
            tool_use_id: message.id,
            content: JSON.stringify(result)
          };
          process.stdout.write(JSON.stringify(response) + '\\n');
        }
      } catch (error) {
        process.stdout.write(JSON.stringify({ type: 'error', error: error.message }) + '\\n');
      }
    });
  } catch (error) {
    log('ERROR', 'Erro fatal: ' + error.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  if (pool) await pool.end();
  process.exit(0);
});

main();`;
}

function generatePackageJson() {
  return JSON.stringify({
    name: 'mcp-mysql-server',
    version: '1.0.0',
    type: 'commonjs',
    scripts: { start: 'node server.js' },
    dependencies: {
      'mysql2': '^3.6.5',
      'dotenv': '^16.3.1'
    }
  }, null, 2);
}

function generateFiles(dbConfig, installDir) {
  if (!fs.existsSync(installDir)) {
    fs.mkdirSync(installDir, { recursive: true });
  }
  const serverJsPath = path.join(installDir, 'server.js');
  fs.writeFileSync(path.join(installDir, '.env'), generateEnv(dbConfig, installDir));
  fs.writeFileSync(serverJsPath, generateServerJs());
  try { fs.chmodSync(serverJsPath, '755'); } catch {}
  fs.writeFileSync(path.join(installDir, 'package.json'), generatePackageJson());
  return { serverJsPath };
}

module.exports = { generateEnv, generateServerJs, generatePackageJson, generateFiles };
```

- [ ] **Step 4: Rodar o teste para verificar aprovação**

```bash
npx jest tests/generator.test.js
```

Expected: PASS — todos os testes passando.

- [ ] **Step 5: Rodar todos os testes juntos**

```bash
npx jest
```

Expected: PASS — todos os testes das 3 suítes passando.

- [ ] **Step 6: Commit**

```bash
git add lib/generator.js tests/generator.test.js
git commit -m "feat: create lib/generator.js for file generation (fixes bugs #2 #5 - LOG_FILE and port)"
```

---

## Task 5: Refatorar setup.js

**Files:**
- Modify: `setup.js`

- [ ] **Step 1: Substituir setup.js inteiro**

Substitua todo o conteúdo de `setup.js` pelo seguinte:

```js
#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');
const { testConnection } = require('./lib/db');
const { generateFiles } = require('./lib/generator');
const { resolveDir, mcpEntryExists, writeMcpConfig } = require('./lib/config');

console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🗄️  MCP MySQL Setup - Configuração Simplificada       ║
║                                                            ║
║     Vamos conectar seu banco MySQL ao Claude AI!          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.yellow.bold('\n📋 PASSO 1: Informações do Banco de Dados MySQL\n'));

    const dbConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'host',
        message: 'Host do MySQL (ex: localhost):',
        default: 'localhost',
        validate: (input) => input.length > 0 ? true : 'Host é obrigatório'
      },
      {
        type: 'number',
        name: 'port',
        message: 'Porta do MySQL:',
        default: 3306
      },
      {
        type: 'input',
        name: 'user',
        message: 'Usuário MySQL:',
        default: 'root',
        validate: (input) => input.length > 0 ? true : 'Usuário é obrigatório'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Senha MySQL:',
        mask: '*'
      },
      {
        type: 'input',
        name: 'database',
        message: 'Nome do banco de dados:',
        validate: (input) => input.length > 0 ? true : 'Banco de dados é obrigatório'
      }
    ]);

    console.log(chalk.yellow.bold('\n🔗 PASSO 2: Testando Conexão\n'));
    const spinner = ora('Testando conexão com MySQL...').start();

    const testResult = await testConnection(dbConfig);

    if (!testResult.success) {
      spinner.fail(chalk.red(`Erro de conexão: ${testResult.error}`));
      console.log(chalk.red('\n❌ Não foi possível conectar ao banco. Verifique as credenciais.\n'));
      process.exit(1);
    }

    spinner.succeed(chalk.green('Conexão bem-sucedida!'));

    console.log(chalk.yellow.bold('\n📁 PASSO 3: Diretório de Instalação\n'));

    const dirChoice = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useCurrentDir',
        message: `Usar diretório atual (${process.cwd()})?`,
        default: true
      }
    ]);

    let installDir;
    if (dirChoice.useCurrentDir) {
      installDir = resolveDir(process.cwd());
    } else {
      const { dir } = await inquirer.prompt([
        {
          type: 'input',
          name: 'dir',
          message: 'Caminho do diretório:',
          default: resolveDir()
        }
      ]);
      installDir = resolveDir(dir);
    }

    console.log(chalk.yellow.bold('\n📝 PASSO 4: Criando Arquivos\n'));

    const { serverJsPath } = generateFiles(dbConfig, installDir);
    console.log(chalk.green('✓ Arquivo .env criado'));
    console.log(chalk.green('✓ Arquivo server.js criado'));
    console.log(chalk.green('✓ Arquivo package.json criado'));

    console.log(chalk.yellow.bold('\n📦 PASSO 5: Instalando Dependências\n'));

    const spinner2 = ora('Instalando npm dependencies...').start();
    try {
      execSync('npm install', { cwd: installDir, stdio: 'pipe' });
      spinner2.succeed(chalk.green('Dependências instaladas!'));
    } catch {
      spinner2.warn(chalk.yellow('Aviso: Instale dependências com: npm install'));
    }

    console.log(chalk.yellow.bold('\n⚙️  PASSO 6: Configurando Claude Code MCP\n'));

    let mcpConfigured = false;
    let shouldWriteMcp = true;

    if (mcpEntryExists()) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Já existe uma configuração mysql no ~/.claude/claude.json. Deseja sobrescrever?',
          default: false
        }
      ]);
      shouldWriteMcp = overwrite;
    }

    if (shouldWriteMcp) {
      try {
        writeMcpConfig(serverJsPath);
        mcpConfigured = true;
        console.log(chalk.green('✓ Configuração MCP adicionada em ~/.claude/claude.json'));
      } catch (err) {
        console.log(chalk.yellow(`⚠️  MCP não configurado automaticamente: ${err.message}`));
        console.log(chalk.yellow('   Configure manualmente em ~/.claude/claude.json'));
      }
    }

    console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              ✅ SETUP CONCLUÍDO COM SUCESSO!               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `));

    console.log(chalk.white.bold('📍 Localização:'), chalk.cyan(installDir));
    console.log(chalk.white.bold('🔑 Host:'), chalk.cyan(dbConfig.host));
    console.log(chalk.white.bold('📚 Database:'), chalk.cyan(dbConfig.database));

    if (mcpConfigured) {
      console.log(chalk.green.bold('\n✨ MCP configurado! Reinicie o Claude Code para ativar.\n'));
    } else {
      console.log(chalk.yellow.bold('\n📝 PRÓXIMAS ETAPAS:\n'));
      console.log(chalk.white('Configure manualmente em ~/.claude/claude.json:'));
      console.log(chalk.gray(`   "mysql": { "command": "node", "args": ["${serverJsPath}"] }`));
    }

  } catch (error) {
    console.log(chalk.red.bold('\n❌ Erro durante setup:\n'), chalk.red(error.message), '\n');
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Rodar todos os testes**

```bash
npx jest
```

Expected: PASS — todos os testes passando.

- [ ] **Step 3: Commit**

```bash
git add setup.js
git commit -m "refactor: rewrite setup.js using lib/, add MCP auto-config step"
```

---

## Task 6: Refatorar web-ui.js

**Files:**
- Modify: `web-ui.js`

- [ ] **Step 1: Substituir web-ui.js inteiro**

Substitua todo o conteúdo de `web-ui.js` pelo seguinte:

```js
#!/usr/bin/env node

require('dotenv').config();
const express = require('express');
const { testConnection } = require('./lib/db');
const { generateFiles } = require('./lib/generator');
const { writeMcpConfig, mcpEntryExists } = require('./lib/config');

const app = express();
const PORT = process.env.PORT || 3333;

app.use(express.json());

// Retorna o cwd do servidor — usado pelo browser para exibir onde os arquivos serão criados
app.get('/api/server-info', (req, res) => {
  res.json({ cwd: process.cwd() });
});

app.post('/api/test-connection', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  const result = await testConnection({ host, port, user, password, database });
  if (result.success) {
    res.json({ success: true, message: '✅ Conexão bem-sucedida!' });
  } else {
    res.json({ success: false, error: result.error });
  }
});

app.post('/api/save-config', async (req, res) => {
  try {
    const { host, port, user, password, database } = req.body;
    const installDir = process.cwd();

    const { serverJsPath } = generateFiles({ host, port, user, password, database }, installDir);

    const alreadyExisted = mcpEntryExists();
    writeMcpConfig(serverJsPath);

    res.json({
      success: true,
      message: '✅ Configuração salva!',
      directory: installDir,
      serverJsPath,
      mcpConfigured: true,
      mcpAlreadyExisted: alreadyExisted
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send(getHtml());
});

function getHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP MySQL Setup</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; width: 100%; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #333; font-size: 28px; margin-bottom: 8px; }
    .header p { color: #666; font-size: 14px; }
    .emoji { font-size: 40px; margin-bottom: 10px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; color: #333; font-weight: 500; margin-bottom: 8px; font-size: 14px; }
    input { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: border-color 0.3s; }
    input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
    .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .button-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 30px; }
    button { padding: 12px 20px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.3s; }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102,126,234,0.3); }
    .btn-secondary { background: #f0f0f0; color: #333; }
    .btn-secondary:hover { background: #e0e0e0; }
    .btn-secondary:disabled, .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
    .status { margin-top: 20px; padding: 12px; border-radius: 8px; text-align: center; font-size: 13px; display: none; }
    .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; display: block; }
    .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; display: block; }
    .status.loading { display: block; color: #004085; background: #d1ecf1; border: 1px solid #bee5eb; }
    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #004085; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 6px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success-screen { display: none; text-align: center; }
    .success-screen.active { display: block; }
    .success-icon { font-size: 60px; margin-bottom: 20px; }
    .success-screen h2 { color: #155724; margin-bottom: 10px; }
    .success-screen p { color: #666; margin-bottom: 15px; line-height: 1.6; }
    .code-block { background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 15px 0; font-family: 'Courier New', monospace; font-size: 12px; word-break: break-all; text-align: left; white-space: pre-wrap; }
    .help-text { font-size: 12px; color: #999; margin-top: 4px; }
    .step-indicator { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 10px; }
    .step { flex: 1; height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden; }
    .step.active { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); }
    .mcp-notice { padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 15px; }
    .mcp-notice.ok { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .mcp-notice.warn { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
  </style>
</head>
<body>
  <div class="container">
    <div class="step-indicator">
      <div class="step active" id="step1"></div>
      <div class="step" id="step2"></div>
      <div class="step" id="step3"></div>
    </div>

    <div id="formScreen">
      <div class="header">
        <div class="emoji">🗄️</div>
        <h1>MCP MySQL</h1>
        <p>Conecte seu banco ao Claude AI</p>
      </div>

      <form id="configForm">
        <div class="form-group">
          <label for="host">Host MySQL</label>
          <input type="text" id="host" name="host" value="localhost" required>
          <div class="help-text">Endereço do servidor MySQL (ex: localhost, 192.168.1.100)</div>
        </div>

        <div class="form-group">
          <div class="input-row">
            <div>
              <label for="port">Porta</label>
              <input type="number" id="port" name="port" value="3306">
            </div>
            <div>
              <label for="user">Usuário</label>
              <input type="text" id="user" name="user" value="root" required>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="password">Senha</label>
          <input type="password" id="password" name="password">
          <div class="help-text">Deixe em branco se não houver senha</div>
        </div>

        <div class="form-group">
          <label for="database">Banco de Dados</label>
          <input type="text" id="database" name="database" required placeholder="seu_banco">
          <div class="help-text">Nome exato do banco que deseja usar</div>
        </div>

        <div class="status" id="status"></div>

        <div class="button-group">
          <button type="button" class="btn-secondary" id="testBtn">🔗 Testar</button>
          <button type="button" class="btn-primary" id="nextBtn" disabled>Continuar</button>
        </div>
      </form>
    </div>

    <div class="success-screen" id="successScreen">
      <div class="success-icon">✅</div>
      <h2>Setup Concluído!</h2>
      <p>Seu servidor MCP MySQL está configurado e pronto para usar.</p>

      <div style="text-align: left; margin-top: 20px;">
        <div class="mcp-notice" id="mcpNotice"></div>

        <p style="font-weight: 600; margin-bottom: 8px;">Configuração gerada:</p>
        <div class="code-block" id="claudeConfig"></div>

        <p style="margin-top: 16px; color: #666; font-size: 12px;">
          ✨ Reinicie o Claude Code e seu banco estará disponível!
        </p>
      </div>

      <button class="btn-primary" onclick="location.reload()" style="margin-top: 20px; width: 100%;">Nova Configuração</button>
    </div>
  </div>

  <script>
    const testBtn = document.getElementById('testBtn');
    const nextBtn = document.getElementById('nextBtn');
    const status = document.getElementById('status');
    const form = document.getElementById('configForm');
    const formScreen = document.getElementById('formScreen');
    const successScreen = document.getElementById('successScreen');

    testBtn.addEventListener('click', async () => {
      const data = Object.fromEntries(new FormData(form));
      testBtn.disabled = true;
      status.className = 'status loading';
      status.innerHTML = '<span class="spinner"></span>Testando conexão...';

      try {
        const response = await fetch('/api/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.success) {
          status.textContent = result.message;
          status.className = 'status success';
          nextBtn.disabled = false;
          document.getElementById('step2').classList.add('active');
        } else {
          status.textContent = '❌ Erro: ' + result.error;
          status.className = 'status error';
          nextBtn.disabled = true;
        }
      } catch (error) {
        status.textContent = '❌ Erro de conexão: ' + error.message;
        status.className = 'status error';
      }

      testBtn.disabled = false;
    });

    nextBtn.addEventListener('click', async () => {
      const data = Object.fromEntries(new FormData(form));
      nextBtn.disabled = true;
      status.className = 'status loading';
      status.innerHTML = '<span class="spinner"></span>Salvando configuração...';

      try {
        const response = await fetch('/api/save-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.success) {
          document.getElementById('step3').classList.add('active');
          formScreen.style.display = 'none';
          successScreen.classList.add('active');

          const mcpNotice = document.getElementById('mcpNotice');
          if (result.mcpConfigured && result.mcpAlreadyExisted) {
            mcpNotice.textContent = '⚠️ Configuração MCP anterior substituída em ~/.claude/claude.json';
            mcpNotice.className = 'mcp-notice warn';
          } else if (result.mcpConfigured) {
            mcpNotice.textContent = '✅ MCP configurado automaticamente em ~/.claude/claude.json';
            mcpNotice.className = 'mcp-notice ok';
          } else {
            mcpNotice.textContent = '⚠️ Configure manualmente (veja abaixo)';
            mcpNotice.className = 'mcp-notice warn';
          }

          document.getElementById('claudeConfig').textContent =
            'Command: node\nArgs: ["' + result.serverJsPath + '"]';
        } else {
          status.textContent = '❌ Erro: ' + result.error;
          status.className = 'status error';
          nextBtn.disabled = false;
        }
      } catch (error) {
        status.textContent = '❌ Erro: ' + error.message;
        status.className = 'status error';
        nextBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🌐 Interface Web - MCP MySQL Setup                     ║
║                                                            ║
║     Abra seu navegador em: http://localhost:3333          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

app.listen(PORT, () => {
  console.log(`\n✨ Servidor rodando em http://localhost:${PORT}\n`);
});
```

- [ ] **Step 2: Rodar todos os testes**

```bash
npx jest
```

Expected: PASS — todos os testes passando.

- [ ] **Step 3: Commit**

```bash
git add web-ui.js
git commit -m "refactor: rewrite web-ui.js using lib/, fix process.cwd() browser bug, add /api/server-info"
```

---

## Task 7: Verificação Final

**Files:** nenhum modificado

- [ ] **Step 1: Rodar todos os testes**

```bash
npx jest --verbose
```

Expected: PASS — todas as suítes (db, config, generator) passando.

- [ ] **Step 2: Verificar que o node não tem erros de syntax nos arquivos principais**

```bash
node --check index.js && node --check setup.js && node --check web-ui.js && node --check lib/db.js && node --check lib/config.js && node --check lib/generator.js
```

Expected: sem output (sem erros de syntax).

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "chore: final verification - all tests passing, no syntax errors"
```
