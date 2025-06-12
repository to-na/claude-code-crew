import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorktreeService } from '../worktreeService.js';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

vi.mock('child_process');
vi.mock('fs');

describe('WorktreeService', () => {
  let service: WorktreeService;
  const mockExecSync = vi.mocked(execSync);
  const mockExistsSync = vi.mocked(existsSync);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorktreeService('/test/repo');
  });

  describe('getWorktrees', () => {
    it('should parse worktree list correctly', () => {
      mockExecSync.mockReturnValue(`worktree /test/repo
HEAD 1234567890abcdef
branch refs/heads/main

worktree /test/repo-feature
HEAD abcdef1234567890
branch refs/heads/feature/test
`);

      const worktrees = service.getWorktrees();

      expect(worktrees).toHaveLength(2);
      expect(worktrees[0]).toEqual({
        path: '/test/repo',
        branch: 'refs/heads/main',
        isMain: true,
        isCurrent: true,
      });
      expect(worktrees[1]).toEqual({
        path: '/test/repo-feature',
        branch: 'refs/heads/feature/test',
        isMain: false,
        isCurrent: false,
      });
    });

    it('should handle single repo without worktrees', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('git worktree not available');
      });

      const worktrees = service.getWorktrees();

      expect(worktrees).toHaveLength(1);
      expect(worktrees[0]?.path).toBe('/test/repo');
      expect(worktrees[0]?.isMain).toBe(true);
    });
  });

  describe('isGitRepository', () => {
    it('should return true if .git exists', () => {
      mockExistsSync.mockReturnValue(true);

      expect(service.isGitRepository()).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('/test/repo/.git');
    });

    it('should return false if .git does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      expect(service.isGitRepository()).toBe(false);
    });
  });

  describe('hasCommits', () => {
    it('should return true if HEAD exists', () => {
      mockExecSync.mockReturnValue('1234567890abcdef');

      expect(service.hasCommits()).toBe(true);
    });

    it('should return false if no commits', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: ambiguous argument');
      });

      expect(service.hasCommits()).toBe(false);
    });
  });

  describe('createWorktree', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(false); // Path doesn't exist
    });

    it('should create worktree with new branch', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('rev-parse --verify')) {
          throw new Error('Branch not found');
        }
        return '';
      });

      const result = service.createWorktree('feature-path', 'feature/new');

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git worktree add -b "feature/new"'),
        expect.any(Object)
      );
    });

    it('should create worktree with existing branch', () => {
      mockExecSync.mockReturnValue('');

      const result = service.createWorktree('feature-path', 'feature/existing');

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git worktree add "/test/repo/feature-path" "feature/existing"'),
        expect.any(Object)
      );
    });

    it('should handle absolute paths', () => {
      mockExecSync.mockReturnValue('');

      const result = service.createWorktree('/absolute/path', 'feature/test');

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git worktree add "/absolute/path"'),
        expect.any(Object)
      );
    });

    it('should fail if path already exists', () => {
      mockExistsSync.mockReturnValue(true);

      const result = service.createWorktree('existing-path', 'feature/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path already exists');
    });

    it('should handle creation errors', () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('worktree add')) {
          throw new Error('fatal: worktree failed');
        }
        return '';
      });

      const result = service.createWorktree('feature-path', 'feature/test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('worktree failed');
    });
  });

  describe('deleteWorktree', () => {
    it('should delete worktree successfully', () => {
      mockExecSync.mockReturnValue(`worktree /test/repo
branch refs/heads/main

worktree /test/repo-feature
branch refs/heads/feature/test
`);

      const result = service.deleteWorktree('/test/repo-feature');

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git worktree remove "/test/repo-feature" --force'),
        expect.any(Object)
      );
    });

    it('should not delete main worktree', () => {
      mockExecSync.mockReturnValue(`worktree /test/repo
branch refs/heads/main
`);

      const result = service.deleteWorktree('/test/repo');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot delete the main worktree');
    });

    it('should handle non-existent worktree', () => {
      mockExecSync.mockReturnValue(`worktree /test/repo
branch refs/heads/main
`);

      const result = service.deleteWorktree('/test/repo-nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Worktree not found');
    });
  });

  describe('mergeWorktree', () => {
    beforeEach(() => {
      mockExecSync.mockReturnValue(`worktree /test/repo
branch refs/heads/main

worktree /test/repo-feature
branch refs/heads/feature/test
`);
    });

    it('should merge branches successfully', () => {
      const result = service.mergeWorktree('feature/test', 'main', false);

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git merge --no-ff "feature/test"'),
        expect.objectContaining({ cwd: '/test/repo' })
      );
    });

    it('should rebase branches when requested', () => {
      const result = service.mergeWorktree('feature/test', 'main', true);

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git rebase "main"'),
        expect.objectContaining({ cwd: '/test/repo-feature' })
      );
    });

    it('should handle merge errors', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('merge') || cmd.includes('rebase')) {
          throw new Error('merge conflict');
        }
        return `worktree /test/repo
branch refs/heads/main

worktree /test/repo-feature
branch refs/heads/feature/test
`;
      });

      const result = service.mergeWorktree('feature/test', 'main', false);

      expect(result.success).toBe(false);
      expect(result.error).toContain('merge conflict');
    });
  });
});