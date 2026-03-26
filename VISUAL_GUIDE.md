# 🎯 MCP MySQL Setup com NPX - Guia Visual

## Como Funciona?

```
┌─────────────────────────────────────┐
│  Seu Terminal                       │
│                                     │
│  $ npx mcp-mysql-setup              │
│                                     │
└──────────────────┬──────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  Menu de Escolha    │
        │                     │
        │ 💻 CLI Interativa   │
        │ 🌐 Interface Web    │
        └─────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   ┌─────────┐            ┌──────────────┐
   │   CLI   │            │  Navegador   │
   │         │            │              │
   │ Terminal│            │ :3333        │
   └────┬────┘            └──────┬───────┘
        │                        │
        └───────────┬────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │ Preenche Dados   │
         │ - Host           │
         │ - Usuario        │
         │ - Senha          │
         │ - Banco          │
         └──────────┬───────┘
                    │
                    ▼
         ┌──────────────────┐
         │ Testa Conexão ✅ │
         └──────────┬───────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Cria Arquivos        │
         │ - .env               │
         │ - server.js          │
         │ - package.json       │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Instala Dependências │
         │ npm install ✓        │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Setup Concluído! ✨  │
         │                      │
         │ ~/mcp-mysql/         │
         │ ├── .env             │
         │ ├── server.js        │
         │ ├── package.json     │
         │ └── mcp-mysql.log    │
         └─────────────────────┘
```

---

## 🎬 Exemplo Real (Passo a Passo)

### Passo 1: Abrir Terminal
```bash
$ npx mcp-mysql-setup
```

### Passo 2: Ver o Menu
```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🗄️  MCP MySQL Setup - Configuração Simplificada       ║
║                                                            ║
║     Vamos conectar seu banco MySQL ao Claude AI!          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

? Modo de setup: (Use arrow keys)
❯ 💻 CLI Interativa (Rápido e Fácil)
  🌐 Interface Web (Visual e Intuitiva)
```

### Passo 3: Escolher (Exemplo: CLI)
```bash
✨ Iniciando setup interativo...

📋 PASSO 1: Informações do Banco de Dados MySQL

? Host do MySQL (ex: localhost): localhost
? Porta do MySQL: 3306
? Usuário MySQL: root
? Senha MySQL: ****
? Nome do banco de dados: meu_banco
```

### Passo 4: Teste de Conexão
```
🔗 PASSO 2: Testando Conexão

✓ Conexão bem-sucedida!
```

### Passo 5: Diretório
```
📁 PASSO 3: Diretório de Instalação

? Usar diretório atual (/home/joao)? Yes
```

### Passo 6: Criação de Arquivos
```
📝 PASSO 4: Criando Arquivos

✓ Arquivo .env criado
✓ Arquivo server.js criado
✓ Arquivo package.json criado
✓ Arquivo README.md criado
```

### Passo 7: Instalação
```
📦 PASSO 5: Instalando Dependências

✓ Dependências instaladas!
```

### Passo 8: Resumo Final
```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              ✅ SETUP CONCLUÍDO COM SUCESSO!               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

📍 Localização: /home/joao/mcp-mysql
🔑 Host: localhost
📚 Database: meu_banco

📝 PRÓXIMAS ETAPAS:

1. Registrar no Claude.ai:
   → Settings → Connectors → Add Custom MCP
   → Command: node
   → Args: ["/home/joao/mcp-mysql/server.js"]

2. Iniciar o servidor:
   → cd /home/joao/mcp-mysql
   → npm start

3. Usar no Claude:
   → "Quantas vendas fizemos hoje?"
   → "Crie um novo cliente..."
   → "Mostre o relatório de estoque"

✨ Tudo pronto! Bom trabalho!
```

---

## 📋 Arquivos Criados

```
/home/joao/mcp-mysql/
│
├── .env                    ← Credenciais (SEGURO!)
│   ├── DB_HOST=localhost
│   ├── DB_USER=root
│   ├── DB_PASSWORD=****
│   └── DB_NAME=meu_banco
│
├── server.js               ← Servidor MCP (🤖)
│
├── package.json            ← Dependências
│
├── .gitignore              ← Ignora .env
│
├── README.md               ← Documentação
│
└── mcp-mysql.log          ← Criado na primeira execução
```

---

## 🔌 Registrar no Claude (Visual)

### Tela 1: Settings
```
Claude.ai
  ↓
Settings (⚙️)
  ↓
Connectors
  ↓
Add Custom MCP
```

### Tela 2: Preencher
```
┌─────────────────────────────┐
│ Add Custom MCP              │
├─────────────────────────────┤
│                             │
│ Type:  Command-based MCP    │
│                             │
│ Command: node               │
│                             │
│ Args:                       │
│ ["/home/joao/              │
│  mcp-mysql/server.js"]      │
│                             │
│ [Save] [Cancel]             │
│                             │
└─────────────────────────────┘
```

### Resultado
```
Claude.ai → Connectors

✅ mysql-server
   Status: Connected
   Type: Command-based
```

---

## ▶️ Iniciar

```bash
$ cd /home/joao/mcp-mysql
$ npm start

[2024-03-26T10:30:45.123Z] INFO: Servidor MCP MySQL iniciado
```

---

## 💬 Usar no Claude

```
Você: "Quantas vendas fizemos este mês?"
      ↓
Claude: [Usa ferramenta: execute_select]
        [Query: SELECT SUM(valor) FROM vendas WHERE MONTH(data) = 3]
      ↓
Claude: "O total de vendas em março foi R$ 45.000,50"
```

---

## ⚙️ Interface Web (Alternativa Visual)

Se escolher web, abre no navegador:

```
http://localhost:3333
```

```
┌─────────────────────────────────────┐
│ 🗄️ MCP MySQL                        │
│ Conecte seu banco ao Claude AI       │
├─────────────────────────────────────┤
│                                     │
│ Host MySQL:  [localhost         ]  │
│                                     │
│ Porta:  [3306]    Usuário: [root]   │
│                                     │
│ Senha:  [••••••••]                 │
│                                     │
│ Banco:  [meu_banco             ]  │
│                                     │
│ [🔗 Testar]  [✓ Continuar]         │
│                                     │
└─────────────────────────────────────┘
```

---

## 🚨 Se Algo Errar

```bash
# Ver os logs
$ cat ~/mcp-mysql/mcp-mysql.log

# Se der erro de conexão
$ mysql -u root -p meu_banco
# Testa manualmente

# Se not found
$ cd ~/mcp-mysql
$ npm install

# Reiniciar tudo
# Ctrl+C no terminal
# npm start novamente
```

---

## ✨ Resultado Final

Você tem agora:

✅ Um servidor MCP conectado ao Claude  
✅ Setup automático em 5 minutos  
✅ Seguro com credenciais protegidas  
✅ Pronto para produção  

**Use:**
```
"Quantos clientes temos?"
"Crie um pedido novo..."
"Mostre relatório de vendas"
"Atualize preços..."
```

---

## 🎉 Pronto!

Você agora tem Claude com acesso direto ao seu banco de dados MySQL!

Enjoy! 🚀
