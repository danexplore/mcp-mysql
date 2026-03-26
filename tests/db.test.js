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
