const fs = require('fs');
const path = require('path');

function generateEnv(dbConfig, installDir) {
  let env = `DB_HOST=${dbConfig.host}
DB_PORT=${dbConfig.port}
DB_USER=${dbConfig.user}
DB_PASSWORD=${dbConfig.password}
DB_NAME=${dbConfig.database}
NODE_ENV=production
LOG_FILE=${path.join(installDir, 'mcp-mysql.log')}`;

  // Add SSL configuration if enabled
  if (dbConfig.ssl && dbConfig.ssl.enable) {
    env += `\nDB_SSL_MODE=${dbConfig.ssl.mode || 'REQUIRED'}`;
    if (dbConfig.ssl.caPath) {
      env += `\nDB_SSL_CA=${dbConfig.ssl.caPath}`;
    }
    if (dbConfig.ssl.certPath) {
      env += `\nDB_SSL_CERT=${dbConfig.ssl.certPath}`;
    }
    if (dbConfig.ssl.keyPath) {
      env += `\nDB_SSL_KEY=${dbConfig.ssl.keyPath}`;
    }
  }

  return env;
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

// Add SSL configuration if environment variables are set
if (process.env.DB_SSL_MODE) {
  const sslConfig = {};

  if (process.env.DB_SSL_MODE === 'REQUIRED') {
    sslConfig.rejectUnauthorized = true;
  } else if (process.env.DB_SSL_MODE === 'SKIP_VERIFY') {
    sslConfig.rejectUnauthorized = false;
  }

  if (process.env.DB_SSL_CA) {
    try {
      sslConfig.ca = [fs.readFileSync(process.env.DB_SSL_CA, 'utf8')];
    } catch (e) {
      console.error(\`Failed to read CA certificate: \${e.message}\`);
      process.exit(1);
    }
  }

  if (process.env.DB_SSL_CERT) {
    try {
      sslConfig.cert = fs.readFileSync(process.env.DB_SSL_CERT, 'utf8');
    } catch (e) {
      console.error(\`Failed to read client certificate: \${e.message}\`);
      process.exit(1);
    }
  }

  if (process.env.DB_SSL_KEY) {
    try {
      sslConfig.key = fs.readFileSync(process.env.DB_SSL_KEY, 'utf8');
    } catch (e) {
      console.error(\`Failed to read client key: \${e.message}\`);
      process.exit(1);
    }
  }

  DB_CONFIG.ssl = Object.keys(sslConfig).length > 0 ? sslConfig : true;
}

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

function formatError(error) {
  switch (error.code) {
    case 'ER_NO_SUCH_TABLE':
      return \`Tabela não encontrada: \${error.sqlMessage || error.message}\`;
    case 'ER_BAD_FIELD_ERROR':
      return \`Coluna não encontrada: \${error.sqlMessage || error.message}\`;
    case 'ER_PARSE_ERROR':
    case 'ER_SYNTAX_ERROR':
      return \`Erro de sintaxe SQL: \${error.sqlMessage || error.message}\`;
    case 'ER_ACCESS_DENIED_ERROR':
      return 'Acesso negado ao banco. Verifique as credenciais no .env';
    case 'ER_DUP_ENTRY':
      return \`Registro duplicado: \${error.sqlMessage || error.message}\`;
    case 'ER_NO_DEFAULT_FOR_FIELD':
      return \`Campo obrigatório sem valor padrão: \${error.sqlMessage || error.message}\`;
    case 'ER_DATA_TOO_LONG':
      return \`Valor muito longo para o campo: \${error.sqlMessage || error.message}\`;
    case 'ER_LOCK_DEADLOCK':
      return 'Deadlock detectado — tente a operação novamente';
    case 'ECONNREFUSED':
      return \`Não foi possível conectar ao MySQL em \${DB_CONFIG.host}:\${DB_CONFIG.port}\`;
    case 'ETIMEDOUT':
      return \`Timeout ao conectar ao MySQL em \${DB_CONFIG.host}:\${DB_CONFIG.port}\`;
    default:
      return error.message;
  }
}

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
    return { success: false, error: formatError(error) };
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
    return { success: false, error: formatError(error) };
  }
}

async function getTableSchema(tableName) {
  try {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(\`Nome de tabela inválido: "\${tableName}". Use apenas letras, números e _\`);
    }
    const conn = await pool.getConnection();
    try {
      const [columns] = await conn.execute(\`
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?
      \`, [tableName, DB_CONFIG.database]);
      if (columns.length === 0) {
        return { success: false, error: \`Tabela "\${tableName}" não encontrada no banco \${DB_CONFIG.database}\` };
      }
      return { success: true, columns };
    } finally {
      conn.release();
    }
  } catch (error) {
    return { success: false, error: formatError(error) };
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
    return { success: false, error: formatError(error) };
  }
}

async function processToolCall(toolName, toolInput) {
  switch(toolName) {
    case 'execute_select': return await executeSelect(toolInput.sql);
    case 'execute_write': return await executeWrite(toolInput.sql);
    case 'get_table_schema': return await getTableSchema(toolInput.table_name);
    case 'list_tables': return await listTables();
    default: return { success: false, error: \`Ferramenta desconhecida: "\${toolName}". Disponíveis: execute_select, execute_write, get_table_schema, list_tables\` };
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
