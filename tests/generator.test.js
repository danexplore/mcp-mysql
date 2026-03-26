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
