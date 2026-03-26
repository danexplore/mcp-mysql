# ⚡ Quick Start - 5 Minutos!

## 1️⃣ Executar o Setup (1 min)

```bash
npx mcp-mysql-setup
```

Escolha uma opção:
- **💻 CLI** - Rápido, fácil, terminal
- **🌐 Web** - Visual, bonito, navegador

## 2️⃣ Responder Perguntas (2 min)

### Se escolheu CLI:
```
? Host do MySQL: localhost
? Porta: 3306
? Usuário: root
? Senha: ****
? Banco: meu_banco
```

### Se escolheu Web:
- Abra http://localhost:3333
- Preencha o formulário
- Clique "Testar" e depois "Continuar"

## 3️⃣ Registrar no Claude (1 min)

1. Abra Claude.ai
2. Settings → Connectors → Add Custom MCP
3. Cole o comando que apareceu:
   ```
   Command: node
   Args: ["/caminho/do/seu/server.js"]
   ```

## 4️⃣ Iniciar Servidor (1 min)

```bash
cd ~/mcp-mysql  # ou onde instalou
npm start
```

Deixe rodando!

## 5️⃣ Testar (1 min)

Abra Claude e pergunte:

```
"Quantas tabelas existem no meu banco?"
```

Se funcionar: **Pronto! 🎉**

---

## 📝 Próximas Perguntas que Pode Fazer

```
"Me mostre os 10 primeiros usuários"
"Qual é o total de vendas de hoje?"
"Crie um novo cliente chamado João"
"Atualize o preço do produto ID 5 para R$ 199"
"Mostre um relatório de vendas por categoria"
```

---

## ⚠️ Não Esqueça

- **Deixe o terminal aberto** com `npm start` rodando
- **Arquivo `.env` é secreto** - nunca compartilhe!
- **Não precisa fazer nada mais** - é automático!

---

## 🚨 Se Algo Não Funcionar

```bash
# Veja os logs
cat ~/mcp-mysql/mcp-mysql.log

# Reinicie tudo
# 1. Feche Claude.ai
# 2. Aperte Ctrl+C no terminal
# 3. Rode npm start novamente
```

---

## ✨ Pronto?

Aproveite! Você agora tem um AI que acessa seu banco! 🚀
