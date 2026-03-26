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
