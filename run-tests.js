#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  const border = '='.repeat(60);
  console.log(colorize(border, 'cyan'));
  console.log(colorize(`🚀 ${title}`, 'bright'));
  console.log(colorize(border, 'cyan'));
}

function printSection(title) {
  console.log(colorize(`\n📋 ${title}`, 'yellow'));
  console.log(colorize('-'.repeat(40), 'yellow'));
}

function runCommand(command, args, cwd, description) {
  return new Promise((resolve, reject) => {
    console.log(colorize(`\n▶️  ${description}`, 'blue'));
    console.log(colorize(`Command: ${command} ${args.join(' ')}`, 'magenta'));
    console.log(colorize(`Directory: ${cwd}`, 'magenta'));
    
    const startTime = Date.now();
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      if (code === 0) {
        console.log(colorize(`✅ ${description} completed successfully (${duration}s)`, 'green'));
        resolve({ success: true, code, duration });
      } else {
        console.log(colorize(`❌ ${description} failed with code ${code} (${duration}s)`, 'red'));
        resolve({ success: false, code, duration });
      }
    });

    child.on('error', (error) => {
      console.log(colorize(`❌ ${description} failed: ${error.message}`, 'red'));
      reject(error);
    });
  });
}

async function checkDependencies() {
  printSection('Checking Dependencies');
  
  const backendPackageJson = path.join(__dirname, 'backend', 'package.json');
  const frontendPackageJson = path.join(__dirname, 'frontend', 'package.json');
  
  if (!fs.existsSync(backendPackageJson)) {
    console.log(colorize('❌ Backend package.json not found', 'red'));
    return false;
  }
  
  if (!fs.existsSync(frontendPackageJson)) {
    console.log(colorize('❌ Frontend package.json not found', 'red'));
    return false;
  }
  
  console.log(colorize('✅ Package.json files found', 'green'));
  return true;
}

async function runBackendTests() {
  printSection('Backend Tests');
  
  const backendDir = path.join(__dirname, 'backend');
  const results = {};
  
  // Run different test categories
  const testCategories = [
    { name: 'Unit Tests', command: 'npm', args: ['run', 'test:unit'] },
    { name: 'Integration Tests', command: 'npm', args: ['run', 'test:integration'] },
    { name: 'All Tests with Coverage', command: 'npm', args: ['run', 'test:coverage'] }
  ];
  
  for (const category of testCategories) {
    try {
      const result = await runCommand(
        category.command,
        category.args,
        backendDir,
        `Running ${category.name}`
      );
      results[category.name] = result;
    } catch (error) {
      results[category.name] = { success: false, error: error.message };
    }
  }
  
  return results;
}

async function runFrontendTests() {
  printSection('Frontend Tests');
  
  const frontendDir = path.join(__dirname, 'frontend');
  const results = {};
  
  // Check if frontend dependencies are installed
  const nodeModulesPath = path.join(frontendDir, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(colorize('📦 Installing frontend dependencies...', 'yellow'));
    const installResult = await runCommand('npm', ['install'], frontendDir, 'Installing frontend dependencies');
    if (!installResult.success) {
      return { 'Dependency Installation': installResult };
    }
  }
  
  const testCategories = [
    { name: 'Unit Tests', command: 'npm', args: ['run', 'test:unit'] },
    { name: 'Component Tests', command: 'npm', args: ['run', 'test:components'] },
    { name: 'Integration Tests', command: 'npm', args: ['run', 'test:integration'] },
    { name: 'All Tests with Coverage', command: 'npm', args: ['run', 'test:coverage'] }
  ];
  
  for (const category of testCategories) {
    try {
      const result = await runCommand(
        category.command,
        category.args,
        frontendDir,
        `Running ${category.name}`
      );
      results[category.name] = result;
    } catch (error) {
      results[category.name] = { success: false, error: error.message };
    }
  }
  
  return results;
}

function printSummary(backendResults, frontendResults) {
  printSection('Test Summary');
  
  console.log(colorize('\n🔧 Backend Results:', 'cyan'));
  for (const [category, result] of Object.entries(backendResults)) {
    const status = result.success ? '✅' : '❌';
    const duration = result.duration ? ` (${result.duration}s)` : '';
    console.log(`  ${status} ${category}${duration}`);
  }
  
  console.log(colorize('\n🎨 Frontend Results:', 'cyan'));
  for (const [category, result] of Object.entries(frontendResults)) {
    const status = result.success ? '✅' : '❌';
    const duration = result.duration ? ` (${result.duration}s)` : '';
    console.log(`  ${status} ${category}${duration}`);
  }
  
  // Overall status
  const allBackendPassed = Object.values(backendResults).every(r => r.success);
  const allFrontendPassed = Object.values(frontendResults).every(r => r.success);
  
  console.log(colorize('\n📊 Overall Status:', 'bright'));
  console.log(`  Backend: ${allBackendPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Frontend: ${allFrontendPassed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (allBackendPassed && allFrontendPassed) {
    console.log(colorize('\n🎉 All tests passed!', 'green'));
    return 0;
  } else {
    console.log(colorize('\n💥 Some tests failed!', 'red'));
    return 1;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const backendOnly = args.includes('--backend-only');
  const frontendOnly = args.includes('--frontend-only');
  
  printHeader('Real-time Order Management System - Test Runner');
  
  // Check dependencies
  const depsOk = await checkDependencies();
  if (!depsOk) {
    process.exit(1);
  }
  
  let backendResults = {};
  let frontendResults = {};
  
  try {
    if (!frontendOnly) {
      backendResults = await runBackendTests();
    }
    
    if (!backendOnly) {
      frontendResults = await runFrontendTests();
    }
    
    const exitCode = printSummary(backendResults, frontendResults);
    process.exit(exitCode);
    
  } catch (error) {
    console.log(colorize(`\n💥 Test runner failed: ${error.message}`, 'red'));
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log(colorize('\n\n🛑 Test runner interrupted', 'yellow'));
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log(colorize('\n\n🛑 Test runner terminated', 'yellow'));
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = { runBackendTests, runFrontendTests, printSummary };
