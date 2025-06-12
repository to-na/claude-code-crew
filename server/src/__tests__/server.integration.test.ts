import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { createTestRepo, cleanupTestRepo, waitFor } from './test-helpers.js';

describe.skipIf(process.env.CI === 'true')('Server Integration Test', () => {
  let serverProcess: any;
  let testRepoPath: string;
  const port = 3098;

  beforeEach(async () => {
    testRepoPath = createTestRepo();
  });

  afterEach(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    cleanupTestRepo(testRepoPath);
  });

  it('should start server successfully', async () => {
    serverProcess = spawn('node', ['dist/server/src/index.js'], {
      cwd: join(process.cwd()),
      env: {
        ...process.env,
        PORT: port.toString(),
        WORK_DIR: testRepoPath,
        NODE_ENV: 'test',
      },
      stdio: 'pipe',
    });

    let serverStarted = false;
    let errorOutput = '';

    serverProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log('Server output:', output);
      if (output.includes(`Server running on`)) {
        serverStarted = true;
      }
    });

    serverProcess.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      console.error('Server error:', data.toString());
    });

    // Wait for server to start
    await waitFor(() => serverStarted, 10000);

    expect(serverStarted).toBe(true);
    expect(errorOutput).toBe('');

    // Test API endpoint
    const response = await fetch(`http://localhost:${port}/api/worktrees`);
    expect(response.ok).toBe(true);
    
    const worktrees = await response.json();
    expect(worktrees).toBeInstanceOf(Array);
    expect(worktrees.length).toBeGreaterThanOrEqual(1);
  });
});