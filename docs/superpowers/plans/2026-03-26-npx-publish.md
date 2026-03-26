# NPX Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaptar o mcp-mysql para ser executável via `npx @danexplore/mcp-mysql`, detectando automaticamente modo servidor (Claude Code) ou modo wizard (terminal).

**Architecture:** `index.js` vira entry point inteligente com detecção TTY+env vars. `lib/config.js` passa a escrever config npx com env vars no `claude.json`. Geração de arquivos locais removida.

**Tech Stack:** Node.js 14+, CommonJS, `@modelcontextprotocol/sdk`, `mysql2`, `inquirer`, `express`

---

## File Map

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Rewrite | `index.js` | Smart entry point: detecta TTY+env vars, despacha para server.js ou wizard-menu.js |
| Create | `wizard-menu.js` | Conteúdo atual de index.js (menu CLI vs Web) |
| Modify | `lib/config.js` | `writeMcpConfig(dbConfig)` escreve config npx com env vars |
| Modify | `setup.js` | Remove passos 4-6 (dir/files/npm); chama `writeMcpConfig(dbConfig)` |
| Modify | `web-ui.js` | Remove `generateFiles`; chama `writeMcpConfig(dbConfig)`; atualiza tela de sucesso |
| Delete | `lib/generator.js` | Não é mais necessário |

---

## Task 1: Criar wizard-menu.js e reescrever index.js

**Files:**
- Create: `wizard-menu.js`
- Modify: `index.js`

- [ ] **Step 1: Criar wizard-menu.js com o conteúdo atual de index.js**

```js
#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');

console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🚀  MCP MySQL Setup - Bem-vindo!                   ║
║                                                            ║
║    Escolha como deseja configurar seu servidor MCP:       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`));

inquirer.prompt([
  {
    type: 'list',
    name: 'mode',
    message: 'Modo de setup:',
    choices: [
      {
        name: '💻 CLI Interativa (Rápido e Fácil)',
        value: 'cli',
        short: 'CLI'
      },
      {
        name: '🌐 Interface Web (Visual e Intuitiva)',
        value: 'web',
        short: 'Web'
      }
    ]
  }
]).then((answers) => {
  if (answers.mode === 'cli') {
    console.log(chalk.green('\n✨ Iniciando setup interativo...\n'));
    require('./setup.js');
  } else {
    console.log(chalk.green('\n✨ Iniciando interface web...\n'));
    require('./web-ui.js');
  }
});
```

- [ ] **Step 2: Reescrever index.js como smart entry point**

```js
#!/usr/bin/env node

const isServerMode =
  !process.stdin.isTTY ||
  (!!process.env.DB_HOST && !!process.env.DB_USER && !!process.env.DB_NAME);

if (isServerMode) {
  require('./server.js');
} else {
  require('./wizard-menu.js');
}
```

- [ ] **Step 3: Verificar que index.js tem shebang e testar detecção**

```bash
node -e "console.log(require('fs').readFileSync('index.js','utf8').split('\n')[0])"
```
Expected: `#!/usr/bin/env node`

- [ ] **Step 4: Commit**

```bash
rtk git add index.js wizard-menu.js && rtk git commit -m "feat: smart entry point with TTY+env var detection"
```

---

## Task 2: Atualizar lib/config.js

**Files:**
- Modify: `lib/config.js`

- [ ] **Step 1: Reescrever writeMcpConfig para aceitar dbConfig e escrever npx config**

Substituir a função atual (linhas 30-41):

```js
function writeMcpConfig(dbConfig) {
  const configPath = getMcpConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const config = readMcpConfig();
  if (!config.mcpServers) config.mcpServers = {};

  const env = {
    DB_HOST: dbConfig.host,
    DB_PORT: String(dbConfig.port || 3306),
    DB_USER: dbConfig.user,
    DB_PASSWORD: dbConfig.password || '',
    DB_NAME: dbConfig.database
  };

  if (dbConfig.ssl && dbConfig.ssl.enable) {
    env.DB_SSL_MODE = dbConfig.ssl.mode || 'REQUIRED';
    if (dbConfig.ssl.caPath) env.DB_SSL_CA = dbConfig.ssl.caPath;
    if (dbConfig.ssl.certPath) env.DB_SSL_CERT = dbConfig.ssl.certPath;
    if (dbConfig.ssl.keyPath) env.DB_SSL_KEY = dbConfig.ssl.keyPath;
  }

  config.mcpServers.mysql = {
    command: 'npx',
    args: ['-y', '@danexplore/mcp-mysql'],
    env
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
```

- [ ] **Step 2: Remover resolveDir das exports (não é mais usada externamente)**

Atualizar a linha de module.exports:

```js
module.exports = { readMcpConfig, writeMcpConfig, mcpEntryExists };
```

Remover também a função `resolveDir` inteira (linhas 9-13) pois não é mais usada em nenhum arquivo após a mudança.

- [ ] **Step 3: Verificar sintaxe**

```bash
node -e "require('./lib/config.js'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
rtk git add lib/config.js && rtk git commit -m "feat: writeMcpConfig writes npx config with env vars"
```

---

## Task 3: Atualizar setup.js

**Files:**
- Modify: `setup.js`

Setup.js precisa:
1. Remover import de `generateFiles` e `resolveDir`
2. Remover PASSO 4 (diretório), PASSO 5 (criar arquivos), PASSO 6 (npm install)
3. Chamar `writeMcpConfig(dbConfig)` em vez de `writeMcpConfig(serverJsPath)`
4. Atualizar o resumo final

- [ ] **Step 1: Atualizar imports no topo de setup.js**

Substituir linha 8-9:
```js
const { generateFiles } = require('./lib/generator');
const { resolveDir, mcpEntryExists, writeMcpConfig } = require('./lib/config');
```

Por:
```js
const { mcpEntryExists, writeMcpConfig } = require('./lib/config');
```

- [ ] **Step 2: Remover PASSO 4 (diretório) de setup.js**

Remover todo o bloco das linhas 132-156:
```js
console.log(chalk.yellow.bold('\n📁 PASSO 4: Diretório de Instalação\n'));

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
```

- [ ] **Step 3: Remover PASSO 5 (criar arquivos) de setup.js**

Remover todo o bloco:
```js
console.log(chalk.yellow.bold('\n📝 PASSO 5: Criando Arquivos\n'));

const { serverJsPath } = generateFiles(dbConfig, installDir);
console.log(chalk.green('✓ Arquivo .env criado'));
console.log(chalk.green('✓ Arquivo server.js criado'));
console.log(chalk.green('✓ Arquivo package.json criado'));
```

- [ ] **Step 4: Remover PASSO 6 (npm install) de setup.js**

Remover todo o bloco:
```js
console.log(chalk.yellow.bold('\n📦 PASSO 6: Instalando Dependências\n'));

const spinner2 = ora('Instalando npm dependencies...').start();
try {
  execSync('npm install', { cwd: installDir, stdio: 'pipe' });
  spinner2.succeed(chalk.green('Dependências instaladas!'));
} catch {
  spinner2.warn(chalk.yellow('Aviso: Instale dependências com: npm install'));
}
```

- [ ] **Step 5: Remover import de execSync**

Remover linha:
```js
const { execSync } = require('child_process');
```

- [ ] **Step 6: Atualizar PASSO 7 → PASSO 4 e chamar writeMcpConfig(dbConfig)**

Substituir o bloco do PASSO 7:
```js
console.log(chalk.yellow.bold('\n⚙️  PASSO 7: Configurando Claude Code MCP\n'));
```
Por:
```js
console.log(chalk.yellow.bold('\n⚙️  PASSO 4: Configurando Claude Code MCP\n'));
```

E substituir a chamada:
```js
writeMcpConfig(serverJsPath);
```
Por:
```js
writeMcpConfig(dbConfig);
```

- [ ] **Step 7: Atualizar resumo final**

Substituir o bloco de resumo no final (a partir de `console.log(chalk.white.bold('📍 Localização:'),...)`):

```js
console.log(chalk.white.bold('🔑 Host:'), chalk.cyan(dbConfig.host));
console.log(chalk.white.bold('📚 Database:'), chalk.cyan(dbConfig.database));

if (mcpConfigured) {
  console.log(chalk.green.bold('\n✨ MCP configurado! Reinicie o Claude Code para ativar.\n'));
  console.log(chalk.gray('   Configuração: npx -y @danexplore/mcp-mysql (com env vars no claude.json)\n'));
} else {
  console.log(chalk.yellow.bold('\n📝 PRÓXIMAS ETAPAS:\n'));
  console.log(chalk.white('Configure manualmente em ~/.claude/claude.json:'));
  console.log(chalk.gray(`   "mysql": { "command": "npx", "args": ["-y", "@danexplore/mcp-mysql"], "env": { "DB_HOST": "${dbConfig.host}", ... } }`));
}
```

- [ ] **Step 8: Verificar sintaxe**

```bash
node -e "require('./setup.js')" 2>&1 | head -5
```
Expected: Banner do setup (não crash de sintaxe) — Ctrl+C para sair

- [ ] **Step 9: Commit**

```bash
rtk git add setup.js && rtk git commit -m "feat: setup.js writes npx config, removes local file generation"
```

---

## Task 4: Atualizar web-ui.js

**Files:**
- Modify: `web-ui.js`

- [ ] **Step 1: Remover import de generateFiles em web-ui.js**

Remover a linha:
```js
const { generateFiles } = require('./lib/generator');
```

- [ ] **Step 2: Atualizar rota /api/save-config**

Substituir o corpo do try em `/api/save-config` (linhas 46-58):

```js
const { host, port, user, password, database, ssl } = req.body;
const parsedPort = parseInt(port) || 3306;
if (!host || !user || !database) {
  return res.json({ success: false, error: 'Campos obrigatórios: host, user, database' });
}
if (parsedPort < 1 || parsedPort > 65535) {
  return res.json({ success: false, error: 'Porta inválida (1-65535)' });
}

const dbConfig = { host, port: parsedPort, user, password, database, ssl };
const alreadyExisted = mcpEntryExists();
writeMcpConfig(dbConfig);

res.json({
  success: true,
  message: '✅ Configuração salva!',
  mcpConfigured: true,
  mcpAlreadyExisted: alreadyExisted
});
```

- [ ] **Step 3: Atualizar tela de sucesso no HTML para mostrar npx config**

Localizar no HTML:
```js
document.getElementById('claudeConfig').textContent =
  'Command: node\\nArgs: ["' + result.serverJsPath + '"]';
```

Substituir por:
```js
document.getElementById('claudeConfig').textContent =
  'Command: npx\nArgs: ["-y", "@danexplore/mcp-mysql"]\nEnv: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME\n\n(Credenciais salvas em ~/.claude/claude.json)';
```

- [ ] **Step 4: Verificar sintaxe de web-ui.js**

```bash
node -e "require('./web-ui.js')" &
sleep 2 && curl -s http://localhost:3333/api/server-info && kill %1
```
Expected: `{"cwd":"..."}` sem erro

- [ ] **Step 5: Commit**

```bash
rtk git add web-ui.js && rtk git commit -m "feat: web-ui writes npx config, removes local file generation"
```

---

## Task 5: Remover lib/generator.js

**Files:**
- Delete: `lib/generator.js`

- [ ] **Step 1: Confirmar que generator.js não é importado em nenhum arquivo**

```bash
rtk grep "generator" --include="*.js" -l
```
Expected: nenhum arquivo listado (após tasks 3 e 4 concluídas)

- [ ] **Step 2: Deletar o arquivo**

```bash
rtk git rm lib/generator.js
```

- [ ] **Step 3: Commit**

```bash
rtk git commit -m "chore: remove lib/generator.js (replaced by npx config approach)"
```

---

## Task 6: Verificação Final

- [ ] **Step 1: Verificar todos os arquivos carregam sem erro**

```bash
node -e "require('./lib/config.js'); console.log('config ok')"
node -e "require('./server.js')" &
sleep 1 && kill %1 && echo "server ok"
```

- [ ] **Step 2: Simular modo servidor (env vars definidas)**

```bash
DB_HOST=localhost DB_USER=root DB_NAME=test node -e "
const isServerMode = !process.stdin.isTTY || (!!process.env.DB_HOST && !!process.env.DB_USER && !!process.env.DB_NAME);
console.log('isServerMode:', isServerMode);
"
```
Expected: `isServerMode: true`

- [ ] **Step 3: Verificar package.json final**

```bash
node -e "const p = require('./package.json'); console.log(p.name, p.bin, Object.keys(p.files || {}))"
```
Expected: `@danexplore/mcp-mysql { 'mcp-mysql': './index.js' } ...`

- [ ] **Step 4: Commit final**

```bash
rtk git add package.json && rtk git commit -m "chore: finalize package.json for npx publish"
```

---

## Publicação (após testes)

```bash
# Login no npm (primeira vez)
npm login

# Publicar
npm publish --access public

# Uso após publicação
npx -y @danexplore/mcp-mysql
```
