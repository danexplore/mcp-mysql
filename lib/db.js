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
