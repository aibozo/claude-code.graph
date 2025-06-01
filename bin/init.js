#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { spawn } from 'child_process';

async function initializeProject() {
  console.log(chalk.blue('🏗️ Initializing claude-code-graph...'));
  console.log('');
  
  try {
    // Create .graph directory
    const graphDir = path.join(process.cwd(), '.graph');
    await fs.mkdir(graphDir, { recursive: true });
    console.log(chalk.green('✅ Created .graph directory'));
    
    // Create .gitkeep file
    await fs.writeFile(path.join(graphDir, '.gitkeep'), '');
    
    // Check if .gitignore exists and update it
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    try {
      let gitignoreContent = '';
      try {
        gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      } catch (e) {
        // .gitignore doesn't exist, will create it
      }
      
      if (!gitignoreContent.includes('.graph/')) {
        const graphIgnore = '\n# Claude Code Graph\n.graph/\n!.graph/.gitkeep\n';
        await fs.writeFile(gitignorePath, gitignoreContent + graphIgnore);
        console.log(chalk.green('✅ Updated .gitignore'));
      }
    } catch (e) {
      console.log(chalk.yellow('⚠️ Could not update .gitignore:'), e.message);
    }
    
    // Run initial graph build
    console.log('');
    console.log(chalk.blue('📊 Building initial graphs...'));
    
    const success = await runGraphBuild();
    
    if (success) {
      console.log('');
      console.log(chalk.green('🎉 Initialization complete!'));
      console.log('');
      console.log('Next steps:');
      console.log(chalk.gray('  1. Start daemon: ') + chalk.cyan('npm run graph:daemon'));
      console.log(chalk.gray('  2. Check status: ') + chalk.cyan('ccg status'));
      console.log(chalk.gray('  3. Try commands: ') + chalk.cyan('ccg /graph-overview'));
    } else {
      console.log('');
      console.log(chalk.yellow('⚠️ Initialization completed with warnings'));
      console.log('💡 Run `ccg doctor` to check for issues');
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Initialization failed:'), error.message);
    process.exit(1);
  }
}

function runGraphBuild() {
  return new Promise((resolve) => {
    const buildScript = path.join(process.cwd(), 'tools', 'codegraph.sh');
    
    const child = spawn('bash', [buildScript], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      resolve(code === 0);
    });
    
    child.on('error', (error) => {
      console.error(chalk.red('❌ Graph build failed:'), error.message);
      resolve(false);
    });
  });
}

const command = process.argv[2];

switch (command) {
  case '--interactive':
  case '-i':
    await initializeInteractive();
    break;
  default:
    await initializeProject();
}

async function initializeInteractive() {
  console.log(chalk.blue('🔧 Interactive Setup'));
  console.log('');
  
  // Simple interactive setup - could be enhanced with inquirer
  console.log('Setting up claude-code-graph in current directory...');
  console.log('Current directory:', process.cwd());
  console.log('');
  
  // Check project type
  const packageJsonExists = await fs.access('package.json').then(() => true).catch(() => false);
  const requirementsTxtExists = await fs.access('requirements.txt').then(() => true).catch(() => false);
  
  if (packageJsonExists) {
    console.log(chalk.green('📦 Detected: Node.js project'));
  }
  if (requirementsTxtExists) {
    console.log(chalk.green('🐍 Detected: Python project'));
  }
  
  console.log('');
  await initializeProject();
}