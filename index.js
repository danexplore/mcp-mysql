#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');
const { exec } = require('child_process');

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
