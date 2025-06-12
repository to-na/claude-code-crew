#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Check if we're in development (no node_modules) or production
const isProduction = fs.existsSync(join(rootDir, 'server', 'dist'));

if (isProduction) {
  // Production mode - run the built server
  const serverPath = join(rootDir, 'server', 'dist', 'server', 'src', 'index.js');
  const workDir = process.cwd();
  
  console.log('Starting Claude Code Crew (Production)...');
  console.log(`Working directory: ${workDir}`);
  console.log(`Open http://localhost:${process.env.PORT || '3001'} in your browser`);
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
  
  const server = spawn('node', [serverPath], {
    env: { 
      ...process.env, 
      WORK_DIR: workDir,
      NODE_ENV: 'production',
      PORT: process.env.PORT || '3001'
    },
    stdio: 'inherit'
  });
  
  server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  
  process.on('SIGINT', () => {
    server.kill('SIGTERM');
    process.exit(0);
  });
} else {
  // Development mode - use start.sh
  const startScript = join(rootDir, 'start.sh');
  
  const proc = spawn('bash', [startScript], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });
  
  proc.on('error', (err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
  
  process.on('SIGINT', () => {
    proc.kill('SIGTERM');
    process.exit(0);
  });
}