import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { Worktree } from '../../../shared/types.js';

export class WorktreeService {
  private rootPath: string;

  constructor(rootPath?: string) {
    this.rootPath = rootPath || process.cwd();
  }

  getWorktrees(): Worktree[] {
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: this.rootPath,
        encoding: 'utf8',
      });

      const worktrees: Worktree[] = [];
      const lines = output.trim().split('\n');

      let currentWorktree: Partial<Worktree> = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as Worktree);
          }
          currentWorktree = {
            path: line.substring(9),
            isMain: false,
            isCurrent: false,
          };
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7);
        } else if (line === 'bare') {
          currentWorktree.isMain = true;
        }
      }

      if (currentWorktree.path) {
        worktrees.push(currentWorktree as Worktree);
      }

      // Mark the first worktree as main if none are marked
      if (worktrees.length > 0 && !worktrees.some(w => w.isMain)) {
        worktrees[0]!.isMain = true;
      }

      // Mark current worktree
      const currentPath = this.rootPath;
      worktrees.forEach(w => {
        w.isCurrent = w.path === currentPath;
      });

      return worktrees;
    } catch (_error) {
      // If git worktree command fails, assume we're in a regular git repo
      return [
        {
          path: this.rootPath,
          branch: this.getCurrentBranch(),
          isMain: true,
          isCurrent: true,
        },
      ];
    }
  }

  private getCurrentBranch(): string {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.rootPath,
        encoding: 'utf8',
      }).trim();
      return branch;
    } catch {
      return 'unknown';
    }
  }

  isGitRepository(): boolean {
    return existsSync(path.join(this.rootPath, '.git'));
  }

  hasCommits(): boolean {
    try {
      execSync('git rev-parse HEAD', {
        cwd: this.rootPath,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  createWorktree(
    worktreePath: string,
    branch: string,
    baseBranch?: string,
    isNewBranch?: boolean
  ): { success: boolean; error?: string } {
    try {
      // Convert relative path to absolute path
      const absolutePath = path.isAbsolute(worktreePath)
        ? worktreePath
        : path.join(this.rootPath, worktreePath);

      // Check if path already exists
      if (existsSync(absolutePath)) {
        return {
          success: false,
          error: 'Path already exists',
        };
      }

      let command: string;

      if (isNewBranch) {
        // Creating a new branch
        if (baseBranch) {
          command = `git worktree add -b "${branch}" "${absolutePath}" "${baseBranch}"`;
        } else {
          command = `git worktree add -b "${branch}" "${absolutePath}"`;
        }
      } else {
        // Using existing branch - check if it exists
        try {
          execSync(`git rev-parse --verify "${branch}"`, {
            cwd: this.rootPath,
            encoding: 'utf8',
            stdio: 'pipe', // Suppress error output
          });
          command = `git worktree add "${absolutePath}" "${branch}"`;
        } catch {
          return {
            success: false,
            error: `Branch "${branch}" does not exist`,
          };
        }
      }

      execSync(command, {
        cwd: this.rootPath,
        encoding: 'utf8',
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create worktree',
      };
    }
  }

  getBranches(): { local: string[]; remote: string[] } {
    try {
      // Get local branches
      const localOutput = execSync('git branch --format="%(refname:short)"', {
        cwd: this.rootPath,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      const localBranches = localOutput
        .trim()
        .split('\n')
        .filter(branch => branch.trim() !== '')
        .map(branch => branch.trim());

      // Get remote branches
      const remoteOutput = execSync('git branch -r --format="%(refname:short)"', {
        cwd: this.rootPath,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      const remoteBranches = remoteOutput
        .trim()
        .split('\n')
        .filter(branch => branch.trim() !== '' && !branch.includes('HEAD'))
        .map(branch => branch.trim());

      return {
        local: localBranches,
        remote: remoteBranches,
      };
    } catch (error) {
      console.error('[WorktreeService] Failed to get branches:', error);
      return {
        local: [],
        remote: [],
      };
    }
  }

  deleteWorktree(worktreePath: string): { success: boolean; error?: string } {
    try {
      const worktrees = this.getWorktrees();
      const worktree = worktrees.find(wt => wt.path === worktreePath);

      if (!worktree) {
        return {
          success: false,
          error: 'Worktree not found',
        };
      }

      if (worktree.isMain) {
        return {
          success: false,
          error: 'Cannot delete the main worktree',
        };
      }

      // Remove the worktree
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: this.rootPath,
        encoding: 'utf8',
      });

      // Delete the branch if it exists
      const branchName = worktree.branch.replace('refs/heads/', '');
      try {
        execSync(`git branch -D "${branchName}"`, {
          cwd: this.rootPath,
          encoding: 'utf8',
        });
      } catch {
        // Branch might not exist or might be checked out elsewhere
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete worktree',
      };
    }
  }

  mergeWorktree(
    sourceBranch: string,
    targetBranch: string,
    useRebase: boolean = false,
  ): { success: boolean; error?: string } {
    try {
      const worktrees = this.getWorktrees();
      const targetWorktree = worktrees.find(
        wt => wt.branch.replace('refs/heads/', '') === targetBranch,
      );

      if (!targetWorktree) {
        return {
          success: false,
          error: 'Target branch worktree not found',
        };
      }

      if (useRebase) {
        const sourceWorktree = worktrees.find(
          wt => wt.branch.replace('refs/heads/', '') === sourceBranch,
        );

        if (!sourceWorktree) {
          return {
            success: false,
            error: 'Source branch worktree not found',
          };
        }

        execSync(`git rebase "${targetBranch}"`, {
          cwd: sourceWorktree.path,
          encoding: 'utf8',
        });
      } else {
        execSync(`git merge --no-ff "${sourceBranch}"`, {
          cwd: targetWorktree.path,
          encoding: 'utf8',
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : useRebase
              ? 'Failed to rebase branches'
              : 'Failed to merge branches',
      };
    }
  }

  deleteWorktreeByBranch(branch: string): { success: boolean; error?: string } {
    try {
      const worktrees = this.getWorktrees();
      const worktree = worktrees.find(
        wt => wt.branch.replace('refs/heads/', '') === branch,
      );

      if (!worktree) {
        return {
          success: false,
          error: 'Worktree not found for branch',
        };
      }

      return this.deleteWorktree(worktree.path);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete worktree by branch',
      };
    }
  }
}