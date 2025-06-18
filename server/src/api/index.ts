import { Express } from 'express';
import { Server } from 'socket.io';
import { promises as fs } from 'fs';
import path from 'path';
import { WorktreeService } from '../services/worktreeService.js';
import { SessionManager } from '../services/sessionManager.js';
import { 
  CreateWorktreeRequest, 
  DeleteWorktreeRequest, 
  MergeWorktreeRequest,
  Worktree 
} from '../../../shared/types.js';

export function setupApiRoutes(app: Express, io: Server, sessionManager: SessionManager) {
  const worktreeService = new WorktreeService(process.env.WORK_DIR);
  
  // Helper function to get worktrees with session info
  const getWorktreesWithSessions = (): Worktree[] => {
    const worktrees = worktreeService.getWorktrees();
    const sessions = sessionManager.getAllSessions();
    
    return worktrees.map(worktree => {
      const session = sessions.find(s => s.worktreePath === worktree.path);
      return {
        ...worktree,
        session: session || undefined,
      };
    });
  };

  // Get all worktrees
  app.get('/api/worktrees', (req, res) => {
    try {
      if (!worktreeService.isGitRepository()) {
        return res.status(400).json({ error: 'Not a git repository' });
      }
      const worktrees = worktreeService.getWorktrees();
      res.json(worktrees);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get worktrees' 
      });
    }
  });

  // Get branches
  app.get('/api/branches', (req, res) => {
    try {
      if (!worktreeService.hasCommits()) {
        return res.status(400).json({ error: 'Repository has no commits' });
      }
      const branches = worktreeService.getBranches();
      res.json(branches);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get branches' 
      });
    }
  });

  // Create a new worktree
  app.post('/api/worktrees', (req, res) => {
    try {
      const { path, branch, baseBranch, isNewBranch } = req.body as CreateWorktreeRequest;
      
      if (!path || !branch) {
        return res.status(400).json({ error: 'Path and branch are required' });
      }

      // Check if repository has commits
      if (!worktreeService.hasCommits()) {
        return res.status(400).json({ 
          error: 'Repository has no commits. Please make at least one commit before creating worktrees.' 
        });
      }

      console.log(`Creating worktree: path="${path}", branch="${branch}", baseBranch="${baseBranch}", isNewBranch=${isNewBranch}`);
      const result = worktreeService.createWorktree(path, branch, baseBranch, isNewBranch);
      
      if (result.success) {
        // Emit worktree update event with session info
        const worktrees = getWorktreesWithSessions();
        io.emit('worktrees:updated', worktrees);
        res.json({ success: true });
      } else {
        console.error(`Failed to create worktree: ${result.error}`);
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create worktree' 
      });
    }
  });

  // Delete worktrees
  app.delete('/api/worktrees', (req, res) => {
    try {
      const { paths } = req.body as DeleteWorktreeRequest;
      
      if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array is required' });
      }

      const errors: string[] = [];
      
      for (const path of paths) {
        const result = worktreeService.deleteWorktree(path);
        if (!result.success) {
          errors.push(`${path}: ${result.error}`);
        }
      }

      if (errors.length > 0) {
        res.status(400).json({ error: errors.join(', ') });
      } else {
        // Emit worktree update event with session info
        const worktrees = getWorktreesWithSessions();
        io.emit('worktrees:updated', worktrees);
        res.json({ success: true });
      }
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete worktrees' 
      });
    }
  });

  // Merge worktree
  app.post('/api/worktrees/merge', (req, res) => {
    try {
      const { 
        sourceBranch, 
        targetBranch, 
        deleteAfterMerge, 
        useRebase 
      } = req.body as MergeWorktreeRequest;
      
      if (!sourceBranch || !targetBranch) {
        return res.status(400).json({ 
          error: 'Source branch and target branch are required' 
        });
      }

      const mergeResult = worktreeService.mergeWorktree(
        sourceBranch,
        targetBranch,
        useRebase
      );
      
      if (!mergeResult.success) {
        return res.status(400).json({ error: mergeResult.error });
      }

      if (deleteAfterMerge) {
        const deleteResult = worktreeService.deleteWorktreeByBranch(sourceBranch);
        if (!deleteResult.success) {
          return res.status(400).json({ 
            error: `Merge succeeded but failed to delete worktree: ${deleteResult.error}` 
          });
        }
      }

      // Emit worktree update event with session info
      const worktrees = getWorktreesWithSessions();
      console.log(`[Merge] Emitting worktrees:updated event with ${worktrees.length} worktrees`);
      io.emit('worktrees:updated', worktrees);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to merge worktrees' 
      });
    }
  });

  // Get instructions file for a worktree
  app.get('/api/worktrees/:worktreePath/instructions', async (req, res) => {
    try {
      const worktreePath = decodeURIComponent(req.params.worktreePath);
      
      // Convert worktree path to instructions filename
      // Replace slashes with underscores and add _instructions.md
      const worktreeName = path.basename(worktreePath);
      const instructionsFileName = `${worktreeName.replace(/\//g, '_')}_instructions.md`;
      const instructionsFilePath = path.join(worktreePath, instructionsFileName);
      
      console.log(`[API] Looking for instructions file: ${instructionsFilePath}`);
      
      try {
        const content = await fs.readFile(instructionsFilePath, 'utf-8');
        res.json({ 
          success: true, 
          content,
          filename: instructionsFileName,
          path: instructionsFilePath
        });
      } catch (fileError) {
        if ((fileError as NodeJS.ErrnoException).code === 'ENOENT') {
          // File not found is expected - just return false without error
          res.json({ 
            success: false,
            filename: instructionsFileName
          });
        } else {
          throw fileError;
        }
      }
    } catch (error) {
      console.error('[API] Error reading instructions file:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read instructions file' 
      });
    }
  });
}