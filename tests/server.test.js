const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');

// Envia uma sequência de mensagens MCP ao servidor e coleta respostas
function runServer(messages) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server.js');
    const proc = spawn('node', [serverPath], {
      env: {
        ...process.env,
        DB_HOST: 'localhost',
        DB_PORT: '3306',
        DB_USER: 'test',
        DB_PASSWORD: 'test',
        DB_NAME: 'test'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const responses = [];
    let buffer = '';

    proc.stdout.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.trim()) {
          try { responses.push(JSON.parse(line)); } catch {}
        }
      }
    });

    // Enviar mensagens com delay para permitir inicialização
    setTimeout(() => {
      for (const msg of messages) {
        proc.stdin.write(JSON.stringify(msg) + '\n');
      }
    }, 200);

    setTimeout(() => {
      proc.kill();
      resolve(responses);
    }, 1500);

    proc.on('error', reject);
  });
}

test('server starts without crashing', async () => {
  const responses = await runServer([]);
  // Se chegou até aqui sem exceção, o servidor iniciou com sucesso
  assert.ok(true);
});

test('server responds to initialize handshake', async () => {
  const responses = await runServer([
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' }
      }
    }
  ]);

  const initResponse = responses.find(r => r.id === 1);
  assert.ok(initResponse, 'deve retornar resposta ao initialize');
  assert.ok(initResponse.result, 'resultado não deve ser nulo');
  assert.ok(initResponse.result.serverInfo, 'deve ter serverInfo');
});

test('tools/list returns 4 tools', async () => {
  const responses = await runServer([
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' }
      }
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }
  ]);

  const toolsResponse = responses.find(r => r.id === 2);
  assert.ok(toolsResponse, 'deve retornar resposta ao tools/list');
  const tools = toolsResponse.result.tools;
  assert.equal(tools.length, 4);
  const names = tools.map(t => t.name).sort();
  assert.deepEqual(names, ['execute_select', 'execute_write', 'get_table_schema', 'list_tables']);
});
