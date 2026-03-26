# MCP MySQL Server — Implementação com SDK oficial

**Data:** 2026-03-26
**Branch:** feature/mcp-protocol
**Worktree:** .worktrees/feature/mcp-protocol

## Contexto

O `server.js` atual implementa um protocolo customizado (escuta `type: 'tool_use'` no stdin), incompatível com o protocolo MCP padrão (JSON-RPC 2.0). Isso impede que o servidor seja reconhecido e usado corretamente pelo Claude Code.

O projeto é distribuído via `npx mcp-mysql-setup`, que solicita as credenciais do banco, gera `server.js` e `.env`, e configura `~/.claude/claude.json` para que o Claude Code consuma o servidor.

## Objetivo

Substituir a implementação customizada do `server.js` pelo `@modelcontextprotocol/sdk` oficial, garantindo compatibilidade total com o protocolo MCP esperado pelo Claude Code.

## Escopo

- **Alvo:** Claude Code exclusivamente (via `stdio` transport)
- **Sem alterações em:** `lib/db.js`, `lib/config.js`, `setup.js`, `web-ui.js`, `index.js`

## Arquitetura

```
Claude Code
    │ stdin/stdout (JSON-RPC 2.0)
    ▼
server.js
    ├── @modelcontextprotocol/sdk  (StdioServerTransport + McpServer)
    └── lib/db.js                  (validateSQL, pool MySQL)
```

O Claude Code lança o processo `node server.js` conforme configurado em `~/.claude/claude.json`. A comunicação ocorre exclusivamente via stdin/stdout usando o transporte `StdioServerTransport` do SDK.

## Ferramentas MCP expostas

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `list_tables` | Lista todas as tabelas do banco | — |
| `get_table_schema` | Retorna colunas e tipos de uma tabela | `table_name: string` |
| `execute_select` | Executa query SELECT | `sql: string` |
| `execute_write` | Executa INSERT, UPDATE ou DELETE | `sql: string` |

### Segurança (mantida de `lib/db.js`)

- Apenas `SELECT`, `INSERT`, `UPDATE`, `DELETE` são permitidos
- `DROP`, `TRUNCATE`, `ALTER`, `CREATE` são bloqueados
- Múltiplos statements (`;`) são bloqueados

## Arquivos modificados

### 1. `package.json`

Adicionar dependência:
```json
"@modelcontextprotocol/sdk": "^1.0.0"
```

### 2. `server.js`

Reescrito usando o SDK:

```js
require('dotenv').config();
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const mysql = require('mysql2/promise');
const fs = require('fs');

// Pool MySQL configurado via .env
// Ferramentas registradas: list_tables, get_table_schema, execute_select, execute_write
// Erros retornados como isError: true (Claude Code exibe mensagem amigável)
```

### 3. `lib/generator.js`

A função `generateServerJs()` é atualizada para gerar o novo código baseado no SDK, mantendo a mesma interface pública do módulo.

## Fluxo por chamada

```
Claude Code → tools/call → server.js → validateSQL (lib/db.js) → pool.execute → resultado
```

**Erros:** Retornados como `{ isError: true, content: [{ type: 'text', text: mensagem }] }` — Claude Code exibe a mensagem sem crashar o servidor.

## Distribuição via npx

O `@modelcontextprotocol/sdk` é listado em `dependencies` do `package.json`. Quando o usuário executa `npx mcp-mysql-setup`, o pacote (incluindo o SDK) é instalado em `~/mcp-mysql/node_modules/`. O `server.js` gerado usa `require('@modelcontextprotocol/sdk/...')` que resolve para esse mesmo `node_modules`.

## O que NÃO muda

- `~/.claude/claude.json` — o comando `node server.js` continua idêntico
- `.env` e credenciais do banco
- `lib/db.js` — validação SQL e pool
- Setup CLI/Web

## Critérios de sucesso

1. `node server.js` inicia sem erros
2. Claude Code reconhece as 4 ferramentas via `tools/list`
3. `list_tables` retorna as tabelas do banco
4. `execute_select` e `execute_write` funcionam corretamente
5. Tentativas de SQL proibido retornam erro amigável
