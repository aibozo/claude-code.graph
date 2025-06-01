#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

async function checkCommand(command, description, optional = false) {
  try {
    await execAsync(`which ${command}`);
    console.log(`${chalk.green('✅')} ${description}: ${chalk.green('Available')}`);
    return true;
  } catch (error) {
    const status = optional ? chalk.yellow('⚠️ ') : chalk.red('❌');
    const message = optional ? chalk.yellow('Optional') : chalk.red('Missing');
    console.log(`${status} ${description}: ${message}`);
    return false;
  }
}

async function checkPythonModule(module, description) {
  try {
    // Try python3.12 first (where modules are installed), then fallback to python3
    await execAsync(`python3.12 -c "import ${module}"`);
    console.log(`${chalk.green('✅')} ${description}: ${chalk.green('Available')}`);
    return true;
  } catch (error) {
    try {
      await execAsync(`python3 -c "import ${module}"`);
      console.log(`${chalk.green('✅')} ${description}: ${chalk.green('Available')}`);
      return true;
    } catch (error2) {
      console.log(`${chalk.red('❌')} ${description}: ${chalk.red('Missing')}`);
      return false;
    }
  }
}

async function main() {
  console.log(chalk.bold.blue('🔍 claude-code-graph Health Check\n'));
  
  let allRequired = true;
  let recommendations = [];
  
  // Core requirements
  console.log(chalk.bold('Core Requirements:'));
  allRequired &= await checkCommand('node', 'Node.js');
  allRequired &= await checkCommand('npm', 'npm');
  allRequired &= await checkCommand('python3', 'Python 3');
  allRequired &= await checkCommand('pip3', 'pip3');
  allRequired &= await checkCommand('git', 'Git');
  
  console.log();
  
  // Graph analysis tools
  console.log(chalk.bold('Graph Analysis Tools:'));
  const hasTreeSitter = await checkCommand('tree-sitter', 'Tree-sitter', true);
  const hasMadge = await checkCommand('madge', 'Madge (JS analysis)', true);
  const hasRipgrep = await checkCommand('rg', 'Ripgrep', true);
  const hasGraphviz = await checkCommand('dot', 'Graphviz', true);
  
  if (!hasTreeSitter) {
    recommendations.push('Install tree-sitter: npm install -g tree-sitter-cli');
  }
  if (!hasMadge) {
    recommendations.push('Install madge: npm install -g madge');
  }
  if (!hasRipgrep) {
    recommendations.push('Install ripgrep: brew install ripgrep (or apt install ripgrep)');
  }
  if (!hasGraphviz) {
    recommendations.push('Install graphviz: brew install graphviz (or apt install graphviz)');
  }
  
  console.log();
  
  // Python modules
  console.log(chalk.bold('Python Modules:'));
  const hasWatchdog = await checkPythonModule('watchdog', 'Watchdog (file watching)');
  const hasNetworkx = await checkPythonModule('networkx', 'NetworkX (graph algorithms)');
  const hasPsutil = await checkPythonModule('psutil', 'Psutil (system monitoring)');
  const hasPyan = await checkPythonModule('pyan', 'Pyan3 (Python analysis)');
  
  if (!hasWatchdog || !hasNetworkx || !hasPsutil || !hasPyan) {
    recommendations.push('Install Python modules: pip3 install --user watchdog networkx psutil pyan3');
  }
  
  console.log();
  
  // Optional advanced tools
  console.log(chalk.bold('Optional Advanced Tools:'));
  await checkCommand('clangd', 'Clangd (C/C++ analysis)', true);
  await checkCommand('watchman', 'Watchman (fast file watching)', true);
  
  console.log();
  
  // Project status
  console.log(chalk.bold('Project Status:'));
  try {
    await execAsync('npm list --depth=0');
    console.log(`${chalk.green('✅')} Node.js dependencies: ${chalk.green('Installed')}`);
  } catch (error) {
    console.log(`${chalk.red('❌')} Node.js dependencies: ${chalk.red('Missing')}`);
    recommendations.push('Install Node.js dependencies: npm install');
  }
  
  console.log();
  
  // Summary
  if (allRequired) {
    console.log(chalk.bold.green('🎉 All core requirements satisfied!'));
  } else {
    console.log(chalk.bold.red('❌ Some core requirements are missing'));
  }
  
  if (recommendations.length > 0) {
    console.log(chalk.bold.yellow('\n💡 Recommendations:'));
    recommendations.forEach(rec => {
      console.log(`   ${chalk.yellow('•')} ${rec}`);
    });
    console.log(`\n   ${chalk.cyan('•')} Or run: npm run install:deps`);
  } else {
    console.log(chalk.bold.green('\n✨ System is fully configured for claude-code-graph!'));
  }
}

main().catch(console.error);