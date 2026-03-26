#!/usr/bin/env node

require('dotenv').config();
const express = require('express');
const { testConnection } = require('./lib/db');
const { writeMcpConfig, mcpEntryExists } = require('./lib/config');

const app = express();
const PORT = process.env.PORT || 3333;

app.use(express.json());

app.post('/api/test-connection', async (req, res) => {
  const { host, port, user, password, database, ssl } = req.body;
  const parsedPort = parseInt(port) || 3306;
  if (!host || !user || !database) {
    return res.json({ success: false, error: 'Campos obrigatórios: host, user, database' });
  }
  if (parsedPort < 1 || parsedPort > 65535) {
    return res.json({ success: false, error: 'Porta inválida (1-65535)' });
  }
  const result = await testConnection({ host, port: parsedPort, user, password, database, ssl });
  if (result.success) {
    res.json({ success: true, message: '✅ Conexão bem-sucedida!' });
  } else {
    res.json({ success: false, error: result.error });
  }
});

app.post('/api/save-config', async (req, res) => {
  try {
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
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send(getHtml());
});

function getHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP MySQL Setup</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; width: 100%; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #333; font-size: 28px; margin-bottom: 8px; }
    .header p { color: #666; font-size: 14px; }
    .emoji { font-size: 40px; margin-bottom: 10px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; color: #333; font-weight: 500; margin-bottom: 8px; font-size: 14px; }
    input { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: border-color 0.3s; }
    input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
    .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .button-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 30px; }
    button { padding: 12px 20px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.3s; }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102,126,234,0.3); }
    .btn-secondary { background: #f0f0f0; color: #333; }
    .btn-secondary:hover { background: #e0e0e0; }
    .btn-secondary:disabled, .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
    .status { margin-top: 20px; padding: 12px; border-radius: 8px; text-align: center; font-size: 13px; display: none; }
    .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; display: block; }
    .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; display: block; }
    .status.loading { display: block; color: #004085; background: #d1ecf1; border: 1px solid #bee5eb; }
    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #004085; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 6px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success-screen { display: none; text-align: center; }
    .success-screen.active { display: block; }
    .success-icon { font-size: 60px; margin-bottom: 20px; }
    .success-screen h2 { color: #155724; margin-bottom: 10px; }
    .success-screen p { color: #666; margin-bottom: 15px; line-height: 1.6; }
    .code-block { background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 15px 0; font-family: 'Courier New', monospace; font-size: 12px; word-break: break-all; text-align: left; white-space: pre-wrap; }
    .help-text { font-size: 12px; color: #999; margin-top: 4px; }
    .step-indicator { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 10px; }
    .step { flex: 1; height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden; }
    .step.active { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); }
    .mcp-notice { padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 15px; }
    .mcp-notice.ok { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .mcp-notice.warn { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
  </style>
</head>
<body>
  <div class="container">
    <div class="step-indicator">
      <div class="step active" id="step1"></div>
      <div class="step" id="step2"></div>
      <div class="step" id="step3"></div>
    </div>

    <div id="formScreen">
      <div class="header">
        <div class="emoji">🗄️</div>
        <h1>MCP MySQL</h1>
        <p>Conecte seu banco ao Claude AI</p>
      </div>

      <form id="configForm">
        <div class="form-group">
          <label for="host">Host MySQL</label>
          <input type="text" id="host" name="host" value="localhost" required>
          <div class="help-text">Endereço do servidor MySQL (ex: localhost, 192.168.1.100)</div>
        </div>

        <div class="form-group">
          <div class="input-row">
            <div>
              <label for="port">Porta</label>
              <input type="number" id="port" name="port" value="3306">
            </div>
            <div>
              <label for="user">Usuário</label>
              <input type="text" id="user" name="user" value="root" required>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="password">Senha</label>
          <input type="password" id="password" name="password">
          <div class="help-text">Deixe em branco se não houver senha</div>
        </div>

        <div class="form-group">
          <label for="database">Banco de Dados</label>
          <input type="text" id="database" name="database" required placeholder="seu_banco">
          <div class="help-text">Nome exato do banco que deseja usar</div>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; font-weight: 500; cursor: pointer;">
            <input type="checkbox" id="enableSSL" name="enableSSL" style="margin-right: 8px; cursor: pointer;">
            🔒 Usar SSL/TLS (Opcional)
          </label>
          <div class="help-text">Recomendado para TiDB Cloud e conexões remotas</div>
        </div>

        <div id="sslConfig" style="display: none; padding: 15px; background: #f9f9f9; border-radius: 8px; margin-bottom: 20px;">
          <div class="form-group">
            <label for="sslMode">Modo de Verificação SSL</label>
            <select id="sslMode" name="sslMode" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px;">
              <option value="REQUIRED">REQUIRED - Verificar certificado do servidor</option>
              <option value="SKIP_VERIFY">SKIP_VERIFY - Não verificar (apenas desenvolvimento)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="caPath">Caminho para CA Certificate (deixe em branco para padrão)</label>
            <input type="text" id="caPath" name="caPath" placeholder="/path/to/ca.pem">
            <div class="help-text">Caminho absoluto para o arquivo CA do servidor</div>
          </div>

          <div class="form-group">
            <label for="certPath">Caminho para Client Certificate (opcional)</label>
            <input type="text" id="certPath" name="certPath" placeholder="/path/to/client-cert.pem">
          </div>

          <div class="form-group">
            <label for="keyPath">Caminho para Client Key (opcional)</label>
            <input type="text" id="keyPath" name="keyPath" placeholder="/path/to/client-key.pem">
          </div>
        </div>

        <div class="status" id="status"></div>

        <div class="button-group">
          <button type="button" class="btn-secondary" id="testBtn">🔗 Testar</button>
          <button type="button" class="btn-primary" id="nextBtn" disabled>Continuar</button>
        </div>
      </form>
    </div>

    <div class="success-screen" id="successScreen">
      <div class="success-icon">✅</div>
      <h2>Setup Concluído!</h2>
      <p>Seu servidor MCP MySQL está configurado e pronto para usar.</p>

      <div style="text-align: left; margin-top: 20px;">
        <div class="mcp-notice" id="mcpNotice"></div>

        <p style="font-weight: 600; margin-bottom: 8px;">Configuração gerada:</p>
        <div class="code-block" id="claudeConfig"></div>

        <p style="margin-top: 16px; color: #666; font-size: 12px;">
          ✨ Reinicie o Claude Code e seu banco estará disponível!
        </p>
      </div>

      <button class="btn-primary" onclick="location.reload()" style="margin-top: 20px; width: 100%;">Nova Configuração</button>
    </div>
  </div>

  <script>
    const testBtn = document.getElementById('testBtn');
    const nextBtn = document.getElementById('nextBtn');
    const status = document.getElementById('status');
    const form = document.getElementById('configForm');
    const formScreen = document.getElementById('formScreen');
    const successScreen = document.getElementById('successScreen');
    const enableSSL = document.getElementById('enableSSL');
    const sslConfig = document.getElementById('sslConfig');

    // Toggle SSL config visibility
    enableSSL.addEventListener('change', () => {
      sslConfig.style.display = enableSSL.checked ? 'block' : 'none';
    });

    function getFormData() {
      const baseData = Object.fromEntries(new FormData(form));
      // Remove the checkbox from data, handle SSL separately
      const data = {
        host: baseData.host,
        port: baseData.port,
        user: baseData.user,
        password: baseData.password,
        database: baseData.database
      };

      if (enableSSL.checked) {
        data.ssl = {
          enable: true,
          mode: document.getElementById('sslMode').value,
          caPath: document.getElementById('caPath').value || null,
          certPath: document.getElementById('certPath').value || null,
          keyPath: document.getElementById('keyPath').value || null
        };
      }
      return data;
    }

    testBtn.addEventListener('click', async () => {
      const data = getFormData();
      testBtn.disabled = true;
      status.className = 'status loading';
      status.innerHTML = '<span class="spinner"></span>Testando conexão...';

      try {
        const response = await fetch('/api/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.success) {
          status.textContent = result.message;
          status.className = 'status success';
          nextBtn.disabled = false;
          document.getElementById('step2').classList.add('active');
        } else {
          status.textContent = '❌ Erro: ' + result.error;
          status.className = 'status error';
          nextBtn.disabled = true;
        }
      } catch (error) {
        status.textContent = '❌ Erro de conexão: ' + error.message;
        status.className = 'status error';
      }

      testBtn.disabled = false;
    });

    nextBtn.addEventListener('click', async () => {
      const data = getFormData();
      nextBtn.disabled = true;
      status.className = 'status loading';
      status.innerHTML = '<span class="spinner"></span>Salvando configuração...';

      try {
        const response = await fetch('/api/save-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.success) {
          document.getElementById('step3').classList.add('active');
          formScreen.style.display = 'none';
          successScreen.classList.add('active');

          const mcpNotice = document.getElementById('mcpNotice');
          if (result.mcpConfigured && result.mcpAlreadyExisted) {
            mcpNotice.textContent = '⚠️ Configuração MCP anterior substituída em ~/.claude/claude.json';
            mcpNotice.className = 'mcp-notice warn';
          } else if (result.mcpConfigured) {
            mcpNotice.textContent = '✅ MCP configurado automaticamente em ~/.claude/claude.json';
            mcpNotice.className = 'mcp-notice ok';
          } else {
            mcpNotice.textContent = '⚠️ Configure manualmente (veja abaixo)';
            mcpNotice.className = 'mcp-notice warn';
          }

          document.getElementById('claudeConfig').textContent =
            'Command: npx\nArgs: ["-y", "@danexplore/mcp-mysql"]\nEnv: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME\n\n(Credenciais salvas em ~/.claude/claude.json)';
        } else {
          status.textContent = '❌ Erro: ' + result.error;
          status.className = 'status error';
          nextBtn.disabled = false;
        }
      } catch (error) {
        status.textContent = '❌ Erro: ' + error.message;
        status.className = 'status error';
        nextBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🌐 Interface Web - MCP MySQL Setup                     ║
║                                                            ║
║     Abra seu navegador em: http://localhost:3333          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✨ Servidor rodando em http://localhost:${PORT}\n`);
});
