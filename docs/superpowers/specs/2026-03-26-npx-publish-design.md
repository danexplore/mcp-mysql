# mcp-mysql — Publicação via NPX

**Data:** 2026-03-26
**Status:** Aprovado

---

## Objetivo

Adaptar o projeto para ser publicável e executável via `npx @danexplore/mcp-mysql`, suportando dois modos de operação:

1. **Modo Servidor** — usado pelo Claude Code via stdio (MCP protocol)
2. **Modo Wizard** — setup interativo quando executado diretamente no terminal

---

## Detecção de Modo (index.js)

`index.js` usa lógica híbrida (TTY + env vars):

```js
const isServerMode =
  !process.stdin.isTTY ||
  (!!process.env.DB_HOST && !!process.env.DB_USER && !!process.env.DB_NAME);

if (isServerMode) require('./server.js');
else require('./wizard-menu.js'); // atual index.js renomeado
```

| Condição | Resultado |
|----------|-----------|
| Rodando no terminal sem env vars | Wizard |
| Piped via stdio (Claude Code) | Servidor |
| Env vars DB_HOST + DB_USER + DB_NAME definidas | Servidor |
| Env vars definidas + TTY | Servidor (env vars têm precedência) |

---

## Mudanças em package.json

```json
{
  "name": "@danexplore/mcp-mysql",
  "bin": { "mcp-mysql": "./index.js" },
  "files": ["index.js", "server.js", "setup.js", "web-ui.js", "lib/"],
  "engines": { "node": ">=14" },
  "keywords": ["mcp", "mysql", "claude", "ai", "modelcontextprotocol"]
}
```

---

## Mudança em lib/config.js — writeMcpConfig

Assinatura atualizada para receber `dbConfig`:

```js
function writeMcpConfig(dbConfig)
```

Escreve no `~/.claude/claude.json`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@danexplore/mcp-mysql"],
      "env": {
        "DB_HOST": "...",
        "DB_PORT": "3306",
        "DB_USER": "...",
        "DB_PASSWORD": "...",
        "DB_NAME": "...",
        "DB_SSL_MODE": "REQUIRED"  // apenas se SSL habilitado
      }
    }
  }
}
```

Callers atualizados: `setup.js` e `web-ui.js`.

---

## Remoção

- `lib/generator.js` — não é mais usado (não gera arquivos locais)

---

## O Que Não Muda

- `server.js` — sem alterações
- `lib/db.js` — sem alterações
- Fluxo visual do wizard (perguntas, cores, steps) — igual
- `setup.js` e `web-ui.js` — apenas a chamada a `writeMcpConfig` muda

---

## Uso Final

```bash
# Setup (terminal)
npx @danexplore/mcp-mysql

# claude.json (gerado pelo wizard)
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@danexplore/mcp-mysql"],
      "env": { "DB_HOST": "localhost", ... }
    }
  }
}
```
