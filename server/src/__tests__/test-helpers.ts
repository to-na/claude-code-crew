import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export function createTestRepo(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'claude-crew-test-'));

  try {
    // Initialize git repo
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test User"', { cwd: tempDir });

    // Create initial commit
    execSync('echo "# Test Repo" > README.md', { cwd: tempDir });
    execSync('git add README.md', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });

    return tempDir;
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export function cleanupTestRepo(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

export async function waitFor(condition: () => boolean, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}