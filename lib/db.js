const mysql = require('mysql2/promise');
const fs = require('fs');

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
  const found = FORBIDDEN.find(kw => new RegExp(`\\b${kw}\\b`).test(upper));
  if (found) {
    throw new Error(`Palavra-chave proibida: ${found}. Operações DDL não são permitidas`);
  }
}

function parseSSLConfig(ssl) {
  const config = {};

  if (ssl.mode === 'REQUIRED') {
    config.rejectUnauthorized = true;
  } else if (ssl.mode === 'SKIP_VERIFY') {
    config.rejectUnauthorized = false;
  }

  if (ssl.caPath) {
    try {
      config.ca = [fs.readFileSync(ssl.caPath, 'utf8')];
    } catch (e) {
      throw new Error(`Failed to read CA certificate: ${e.message}`);
    }
  }

  if (ssl.certPath) {
    try {
      config.cert = fs.readFileSync(ssl.certPath, 'utf8');
    } catch (e) {
      throw new Error(`Failed to read client certificate: ${e.message}`);
    }
  }

  if (ssl.keyPath) {
    try {
      config.key = fs.readFileSync(ssl.keyPath, 'utf8');
    } catch (e) {
      throw new Error(`Failed to read client key: ${e.message}`);
    }
  }

  return Object.keys(config).length > 0 ? config : true;
}

async function testConnection({ host, port, user, password, database, ssl }) {
  try {
    const connectionConfig = {
      host,
      port: parseInt(port) || 3306,
      user,
      password,
      database
    };

    // Add SSL configuration if provided
    if (ssl && ssl.enable) {
      connectionConfig.ssl = parseSSLConfig(ssl);
    }

    const connection = await mysql.createConnection(connectionConfig);
    await connection.end();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { validateSQL, testConnection };
