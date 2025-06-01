#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

async function checkDaemonStatus() {
  const lockFile = path.join(process.cwd(), '.graph', 'daemon.lock');
  const metricsFile = path.join(process.cwd(), '.graph', 'metrics.json');
  
  try {
    // Check lock file
    const lockExists = await fs.access(lockFile).then(() => true).catch(() => false);
    
    if (!lockExists) {
      console.log(chalk.yellow('📊 Claude Code Graph Status'));
      console.log('');
      console.log(chalk.red('🔴 Daemon: Not running'));
      console.log('');
      console.log('💡 Start daemon with: npm run graph:daemon');
      return;
    }
    
    // Read PID and check if process exists
    const pidContent = await fs.readFile(lockFile, 'utf8');
    const pid = parseInt(pidContent.trim());
    
    let daemonRunning = false;
    try {
      process.kill(pid, 0); // Check if process exists
      daemonRunning = true;
    } catch (e) {
      // Process doesn't exist, clean up stale lock file
      await fs.unlink(lockFile).catch(() => {});
    }
    
    console.log(chalk.blue('📊 Claude Code Graph Status'));
    console.log('');
    
    if (daemonRunning) {
      console.log(chalk.green('🟢 Daemon: Running') + chalk.gray(` (PID: ${pid})`));
      
      // Show daemon metrics if available
      try {
        const metricsContent = await fs.readFile(metricsFile, 'utf8');
        const metrics = JSON.parse(metricsContent);
        
        if (metrics.daemon) {
          const daemon = metrics.daemon;
          console.log(chalk.gray('   Started: ') + daemon.daemon_start);
          console.log(chalk.gray('   Updates: ') + daemon.updates);
          console.log(chalk.gray('   Errors: ') + daemon.errors);
          console.log(chalk.gray('   Avg Time: ') + `${daemon.avg_time.toFixed(2)}s`);
          if (daemon.last_update) {
            console.log(chalk.gray('   Last Update: ') + daemon.last_update);
          }
        }
      } catch (e) {
        // Metrics not available
      }
    } else {
      console.log(chalk.red('🔴 Daemon: Not running') + chalk.gray(' (stale lock file cleaned)'));
    }
    
    // Show general graph status
    try {
      const metricsContent = await fs.readFile(metricsFile, 'utf8');
      const metrics = JSON.parse(metricsContent);
      
      console.log('');
      console.log(chalk.blue('📈 Graph Status:'));
      console.log(chalk.gray('   Total Files: ') + (metrics.total_files || 'Unknown'));
      console.log(chalk.gray('   Last Build: ') + (metrics.timestamp || 'Unknown'));
      
      if (metrics.by_language) {
        console.log('');
        console.log(chalk.blue('🔤 Languages:'));
        Object.entries(metrics.by_language).forEach(([lang, count]) => {
          if (count > 0) {
            console.log(chalk.gray(`   ${lang}: `) + count + ' files');
          }
        });
      }
    } catch (e) {
      console.log('');
      console.log(chalk.yellow('⚠️ No graph metrics available'));
      console.log('💡 Run: npm run graph:build');
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error checking status:'), error.message);
  }
}

// Handle signals for daemon control
function handleDaemonControl() {
  const command = process.argv[2];
  const lockFile = path.join(process.cwd(), '.graph', 'daemon.lock');
  
  switch (command) {
    case 'stop':
      return stopDaemon(lockFile);
    case 'restart':
      return restartDaemon(lockFile);
    case 'refresh':
      return refreshDaemon(lockFile);
    default:
      return checkDaemonStatus();
  }
}

async function stopDaemon(lockFile) {
  try {
    const pidContent = await fs.readFile(lockFile, 'utf8');
    const pid = parseInt(pidContent.trim());
    
    process.kill(pid, 'SIGTERM');
    console.log(chalk.green('✅ Daemon stop signal sent'));
    
    // Wait a bit and check if it stopped
    setTimeout(async () => {
      try {
        process.kill(pid, 0);
        console.log(chalk.yellow('⚠️ Daemon still running, sending SIGKILL'));
        process.kill(pid, 'SIGKILL');
      } catch (e) {
        console.log(chalk.green('✅ Daemon stopped'));
      }
    }, 2000);
    
  } catch (error) {
    console.log(chalk.yellow('⚠️ Daemon not running or lock file missing'));
  }
}

async function restartDaemon(lockFile) {
  console.log(chalk.blue('🔄 Restarting daemon...'));
  await stopDaemon(lockFile);
  
  setTimeout(() => {
    console.log(chalk.blue('🚀 Starting daemon...'));
    console.log('💡 Run: npm run graph:daemon');
  }, 3000);
}

async function refreshDaemon(lockFile) {
  try {
    const pidContent = await fs.readFile(lockFile, 'utf8');
    const pid = parseInt(pidContent.trim());
    
    process.kill(pid, 'SIGUSR1');
    console.log(chalk.green('✅ Daemon refresh signal sent'));
    
  } catch (error) {
    console.log(chalk.yellow('⚠️ Daemon not running'));
    console.log('💡 Run: npm run graph:build');
  }
}

await handleDaemonControl();