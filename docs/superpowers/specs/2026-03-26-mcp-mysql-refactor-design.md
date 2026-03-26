# MCP MySQL — Refatoração Completa + Auto-configuração Claude Code

**Data:** 2026-03-26
**Status:** Aprovado

---

## Objetivo

Refatorar o projeto `mcp-mysql-setup` para:
1. Eliminar duplicação de lógica entre CLI e Web
2. Corrigir 5 bugs existentes
3. Adicionar auto-configuração do MCP no `~/.claude/claude.json`

---

## Arquitetura

### Estrutura de Arquivos

```
mcp-mysql/
├── index.js              # Entry point — menu CLI vs Web (limpo)
├── setup.js              # CLI interativa — apenas UI, usa lib/
├── web-ui.js             # Servidor Express — apenas rotas e HTML, usa lib/
├── lib/
│   ├── db.js             # testConnection(), validateSQL()
│   ├── generator.js      # Geração de server.js, .env, package.json
│   └── config.js         # os.homedir(), resolveDir(), writeMcpConfig()
└── package.json
```

### Princípio de Separação

- `lib/db.js` → depende apenas de `mysql2/promise`
- `lib/generator.js` → depende apenas de `fs`, `path`, `os`
- `lib/config.js` → depende apenas de `fs`, `os`, `path`
- Nenhum arquivo `lib/` importa os outros — sem acoplamento cruzado
- `setup.js` e `web-ui.js` são puramente camada de UI

---

## Correções de Bugs

| # | Arquivo | Bug | Correção |
|---|---------|-----|----------|
| 1 | `web-ui.js:441` | `process.cwd()` no browser → `ReferenceError` | Novo endpoint `GET /api/server-info` retorna `{ cwd }` do servidor |
| 2 | `web-ui.js:49` | `\${dir}` com escape → `LOG_FILE` literal no `.env` | Movido para `generator.js` com interpolação correta |
| 3 | `setup.js:109` | `process.env.HOME` indefinido no Windows | `lib/config.js` usa `os.homedir()` |
| 4 | `setup.js:24` | `testConnection()` ignora porta do usuário | `lib/db.js` inclui `port` na conexão MySQL |
| 5 | `setup.js` (server.js gerado) | `DB_CONFIG` gerado não inclui `port` | `lib/generator.js` inclui porta corretamente |

---

## Nova Feature: Auto-configuração Claude Code

### Comportamento

Ao final do setup (CLI e Web), o sistema:

1. Localiza `~/.claude/claude.json` usando `os.homedir()`
2. Se o arquivo não existir, cria com estrutura base `{ "mcpServers": {} }`
3. Se já existir entrada `mcpServers.mysql`:
   - **CLI:** pergunta ao usuário (`inquirer.confirm`) se deseja sobrescrever
   - **Web:** responde com `{ exists: true }` e o frontend exibe confirmação
4. Adiciona ou sobrescreve a entrada:
   ```json
   {
     "mcpServers": {
       "mysql": {
         "command": "node",
         "args": ["/caminho/absoluto/para/server.js"]
       }
     }
   }
   ```
5. Salva o arquivo preservando outras entradas existentes em `mcpServers`

### Implementação em `lib/config.js`

```js
// Assinatura das funções
function resolveDir(userChoice)         // retorna caminho absoluto, usa os.homedir()
function readMcpConfig()                 // lê ~/.claude/claude.json, retorna {} se não existir
function writeMcpConfig(serverJsPath)   // escreve entrada mysql no arquivo
function mcpEntryExists()               // retorna true se mcpServers.mysql já existe
```

---

## Fluxo de Dados

### CLI

```
index.js → setup.js
  1. Coleta dados do banco (inquirer)
  2. lib/db.js → testConnection({ host, port, user, password, database })
  3. lib/config.js → resolveDir(userChoice)
  4. lib/generator.js → generateFiles(dbConfig, installDir)
     - Cria .env com LOG_FILE real
     - Cria server.js com DB_CONFIG incluindo port
     - Cria package.json
  5. npm install (execSync)
  6. lib/config.js → mcpEntryExists() → pergunta se sobrescreve
  7. lib/config.js → writeMcpConfig(serverJsPath)
  8. Exibe resumo final
```

### Web

```
index.js → web-ui.js
  GET  /                    → HTML estático (string separada, não inline no handler)
  GET  /api/server-info     → { cwd: process.cwd() }          [novo]
  POST /api/test-connection → lib/db.js.testConnection()
  POST /api/save-config     → lib/generator.js.generateFiles()
                              lib/config.js.writeMcpConfig()
                              → { success, directory, mcpConfigured, mcpAlreadyExisted }
```

O frontend usa `mcpAlreadyExisted: true` para exibir aviso de que a configuração existente foi substituída.

---

## Comportamento de Erro

- `testConnection` falha → mensagem clara com o erro do MySQL, sem `process.exit(1)` — retorna `{ success: false, error }`
- `writeMcpConfig` falha (sem permissão, etc.) → setup continua, exibe aviso específico ("MCP não configurado automaticamente — configure manualmente")
- Diretório inválido → `generator.js` lança erro com mensagem descritiva

---

## O Que Não Muda

- Interface visual da CLI e Web (mesmas cores, mesmo fluxo de perguntas)
- Conteúdo do `server.js` gerado (exceto adição de `port`)
- Dependências do `package.json` do projeto
- Compatibilidade com Node.js 14+
