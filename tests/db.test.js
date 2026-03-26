const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSQL } = require('../lib/db');

test('permite SELECT', () => {
  assert.doesNotThrow(() => validateSQL('SELECT * FROM users'));
});

test('permite INSERT', () => {
  assert.doesNotThrow(() => validateSQL('INSERT INTO users (name) VALUES ("test")'));
});

test('permite UPDATE', () => {
  assert.doesNotThrow(() => validateSQL('UPDATE users SET name = "x" WHERE id = 1'));
});

test('permite DELETE', () => {
  assert.doesNotThrow(() => validateSQL('DELETE FROM users WHERE id = 1'));
});

test('ignora maiúsculas/minúsculas', () => {
  assert.doesNotThrow(() => validateSQL('select * from users'));
});

test('rejeita DROP como operação inicial', () => {
  assert.throws(() => validateSQL('DROP TABLE users'), /Operação não permitida/);
});

test('rejeita SHOW (operação desconhecida)', () => {
  assert.throws(() => validateSQL('SHOW TABLES'), /Operação não permitida/);
});

test('rejeita SELECT que contém TRUNCATE', () => {
  assert.throws(() => validateSQL('SELECT TRUNCATE(1.5, 0)'), /Operação contém palavras-chave proibidas/);
});
