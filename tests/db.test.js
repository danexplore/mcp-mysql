const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSQL } = require('../lib/db');

const ALL_DML = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

test('permite SELECT', () => {
  assert.doesNotThrow(() => validateSQL('SELECT * FROM users', ALL_DML));
});

test('permite INSERT', () => {
  assert.doesNotThrow(() => validateSQL('INSERT INTO users (name) VALUES ("test")', ALL_DML));
});

test('permite UPDATE', () => {
  assert.doesNotThrow(() => validateSQL('UPDATE users SET name = "x" WHERE id = 1', ALL_DML));
});

test('permite DELETE', () => {
  assert.doesNotThrow(() => validateSQL('DELETE FROM users WHERE id = 1', ALL_DML));
});

test('ignora maiúsculas/minúsculas', () => {
  assert.doesNotThrow(() => validateSQL('select * from users', ALL_DML));
});

test('rejeita DROP como operação inicial', () => {
  assert.throws(() => validateSQL('DROP TABLE users', ALL_DML), /Operação "DROP" não permitida/);
});

test('rejeita SHOW (operação desconhecida)', () => {
  assert.throws(() => validateSQL('SHOW TABLES', ALL_DML), /Operação "SHOW" não permitida/);
});

test('rejeita SELECT que contém TRUNCATE', () => {
  assert.throws(() => validateSQL('SELECT TRUNCATE(1.5, 0)', ALL_DML), /Palavra-chave proibida: TRUNCATE/);
});

test('rejeita múltiplos statements com ponto-e-vírgula', () => {
  assert.throws(() => validateSQL('SELECT 1; DROP TABLE users', ALL_DML), /Múltiplos statements não são permitidos/);
});

test('SELECT-only: rejeita INSERT quando allowed é apenas SELECT', () => {
  assert.throws(() => validateSQL('INSERT INTO users (name) VALUES ("x")', ['SELECT']), /Operação "INSERT" não permitida/);
});

test('DML sem SELECT: rejeita SELECT quando allowed é apenas INSERT/UPDATE/DELETE', () => {
  assert.throws(() => validateSQL('SELECT * FROM users', ['INSERT', 'UPDATE', 'DELETE']), /Operação "SELECT" não permitida/);
});
