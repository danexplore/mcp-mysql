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

function validateSQL(sql, allowed) {
  const upper = sql.trim().toUpperCase();
  const firstWord = upper.split(/\s/)[0];
  if (!allowed.some(op => upper.startsWith(op))) {
    throw new Error(`Operação "${firstWord}" não permitida. Use: ${allowed.join(', ')}`);
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
      validateSQL(sql, ['SELECT']);
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
      validateSQL(sql, ['INSERT', 'UPDATE', 'DELETE']);
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
