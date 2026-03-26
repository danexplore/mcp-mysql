#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');
const { testConnection } = require('./lib/db');
const { generateFiles } = require('./lib/generator');
const { resolveDir, mcpEntryExists, writeMcpConfig } = require('./lib/config');

console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🗄️  MCP MySQL Setup - Configuração Simplificada       ║
║                                                            ║
║     Vamos conectar seu banco MySQL ao Claude AI!          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.yellow.bold('\n📋 PASSO 1: Informações do Banco de Dados MySQL\n'));

    const dbConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'host',
        message: 'Host do MySQL (ex: localhost):',
        default: 'localhost',
        validate: (input) => input.length > 0 ? true : 'Host é obrigatório'
      },
      {
        type: 'number',
        name: 'port',
        message: 'Porta do MySQL:',
        default: 3306
      },
      {
        type: 'input',
        name: 'user',
        message: 'Usuário MySQL:',
        default: 'root',
        validate: (input) => input.length > 0 ? true : 'Usuário é obrigatório'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Senha MySQL:',
        mask: '*'
      },
      {
        type: 'input',
        name: 'database',
        message: 'Nome do banco de dados:',
        validate: (input) => input.length > 0 ? true : 'Banco de dados é obrigatório'
      }
    ]);

    console.log(chalk.yellow.bold('\n🔒 PASSO 2A: Configuração SSL/TLS (Opcional)\n'));

    const sslConfig = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enable',
        message: 'Deseja usar SSL/TLS para a conexão?',
        default: false
      },
      {
        type: 'list',
        name: 'mode',
        message: 'Modo de verificação SSL:',
        choices: [
          { name: 'REQUIRED - Verificar certificado do servidor', value: 'REQUIRED' },
          { name: 'SKIP_VERIFY - Não verificar certificado (apenas desenvolvimento)', value: 'SKIP_VERIFY' }
        ],
        default: 'REQUIRED',
        when: (answers) => answers.enable
      },
      {
        type: 'input',
        name: 'caPath',
        message: 'Caminho para certificado CA (deixe em branco para padrão):',
        when: (answers) => answers.enable && answers.mode === 'REQUIRED'
      },
      {
        type: 'input',
        name: 'certPath',
        message: 'Caminho para certificado do cliente (opcional):',
        when: (answers) => answers.enable
      },
      {
        type: 'input',
        name: 'keyPath',
        message: 'Caminho para chave privada (opcional):',
        when: (answers) => answers.enable
      }
    ]);

    // Merge SSL config into dbConfig
    if (sslConfig.enable) {
      dbConfig.ssl = {
        enable: true,
        mode: sslConfig.mode,
        caPath: sslConfig.caPath || null,
        certPath: sslConfig.certPath || null,
        keyPath: sslConfig.keyPath || null
      };
    }

    console.log(chalk.yellow.bold('\n🔗 PASSO 3: Testando Conexão\n'));
    const spinner = ora('Testando conexão com MySQL...').start();

    const testResult = await testConnection(dbConfig);

    if (!testResult.success) {
      spinner.fail(chalk.red(`Erro de conexão: ${testResult.error}`));
      console.log(chalk.red('\n❌ Não foi possível conectar ao banco. Verifique as credenciais.\n'));
      process.exit(1);
    }

    spinner.succeed(chalk.green('Conexão bem-sucedida!'));
    if (dbConfig.ssl?.enable) {
      console.log(chalk.cyan('  🔒 SSL: Ativado (' + dbConfig.ssl.mode + ')'));
    }

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

    console.log(chalk.yellow.bold('\n📝 PASSO 5: Criando Arquivos\n'));

    const { serverJsPath } = generateFiles(dbConfig, installDir);
    console.log(chalk.green('✓ Arquivo .env criado'));
    console.log(chalk.green('✓ Arquivo server.js criado'));
    console.log(chalk.green('✓ Arquivo package.json criado'));

    console.log(chalk.yellow.bold('\n📦 PASSO 6: Instalando Dependências\n'));

    const spinner2 = ora('Instalando npm dependencies...').start();
    try {
      execSync('npm install', { cwd: installDir, stdio: 'pipe' });
      spinner2.succeed(chalk.green('Dependências instaladas!'));
    } catch {
      spinner2.warn(chalk.yellow('Aviso: Instale dependências com: npm install'));
    }

    console.log(chalk.yellow.bold('\n⚙️  PASSO 7: Configurando Claude Code MCP\n'));

    let mcpConfigured = false;
    let shouldWriteMcp = true;

    if (mcpEntryExists()) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Já existe uma configuração mysql no ~/.claude/claude.json. Deseja sobrescrever?',
          default: false
        }
      ]);
      shouldWriteMcp = overwrite;
    }

    if (shouldWriteMcp) {
      try {
        writeMcpConfig(serverJsPath);
        mcpConfigured = true;
        console.log(chalk.green('✓ Configuração MCP adicionada em ~/.claude/claude.json'));
      } catch (err) {
        console.log(chalk.yellow(`⚠️  MCP não configurado automaticamente: ${err.message}`));
        console.log(chalk.yellow('   Configure manualmente em ~/.claude/claude.json'));
      }
    }

    console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              ✅ SETUP CONCLUÍDO COM SUCESSO!               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `));

    console.log(chalk.white.bold('📍 Localização:'), chalk.cyan(installDir));
    console.log(chalk.white.bold('🔑 Host:'), chalk.cyan(dbConfig.host));
    console.log(chalk.white.bold('📚 Database:'), chalk.cyan(dbConfig.database));

    if (mcpConfigured) {
      console.log(chalk.green.bold('\n✨ MCP configurado! Reinicie o Claude Code para ativar.\n'));
    } else {
      console.log(chalk.yellow.bold('\n📝 PRÓXIMAS ETAPAS:\n'));
      console.log(chalk.white('Configure manualmente em ~/.claude/claude.json:'));
      console.log(chalk.gray(`   "mysql": { "command": "node", "args": ["${serverJsPath}"] }`));
    }

  } catch (error) {
    console.log(chalk.red.bold('\n❌ Erro durante setup:\n'), chalk.red(error.message), '\n');
    process.exit(1);
  }
}

main();
