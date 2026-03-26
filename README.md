# mcp-mysql

Setup tool que conecta seu banco MySQL/TiDB ao Claude Code via MCP.

## Como usar

### 1. Rodar o setup

```bash
node index.js
```

Escolha entre **CLI** (terminal) ou **Web** (abre em http://localhost:3333).

Informe as credenciais do banco:
- Host, porta, usuário, senha, nome do banco
- (Opcional) configuração SSL

O setup vai:
1. Testar a conexão
2. Gerar `server.js` e `.env` em `~/mcp-mysql/`
3. Instalar dependências (`npm install`)
4. Registrar o servidor em `~/.claude/claude.json`

### 2. Reiniciar o Claude Code

Feche e abra o Claude Code para ele carregar o novo MCP.

### 3. Verificar

No Claude Code, pergunte algo como:
```
Liste as tabelas do banco
```

---

## Fluxo simplificado

```
node index.js
    └─→ coleta credenciais
    └─→ testa conexão
    └─→ gera ~/mcp-mysql/server.js + .env
    └─→ npm install em ~/mcp-mysql/
    └─→ atualiza ~/.claude/claude.json
          └─→ Claude Code inicia node server.js automaticamente
```

---

## Ferramentas MCP expostas

| Ferramenta | Descrição |
|---|---|
| `list_tables` | Lista todas as tabelas |
| `get_table_schema` | Colunas e tipos de uma tabela |
| `execute_select` | Executa SELECT |
| `execute_write` | Executa INSERT, UPDATE ou DELETE |

---

## Desenvolvimento

```bash
# Rodar setup via CLI diretamente
node setup.js

# Rodar setup via Web diretamente
node web-ui.js

# Rodar testes
npm test
```

### Estrutura

```
index.js          # Menu principal (CLI ou Web)
setup.js          # Setup via terminal
web-ui.js         # Setup via navegador
server.js         # Servidor MCP (usado após setup)
lib/
  db.js           # validateSQL, testConnection
  generator.js    # Gera server.js e package.json
  config.js       # Lê/escreve ~/.claude/claude.json
tests/            # 33 testes (node:test)
```

---

## Segurança

- Queries validadas: apenas SELECT/INSERT/UPDATE/DELETE permitidos
- DDL bloqueado: DROP, TRUNCATE, ALTER, CREATE rejeitados
- Multi-statement bloqueado: `;` não permitido
- Web UI vinculada em `127.0.0.1` (só acesso local)
- Credenciais em `.env` (nunca no código)
