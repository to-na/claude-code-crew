import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { setupApiRoutes } from '../api/index.js';
import { createTestRepo, cleanupTestRepo } from './test-helpers.js';
import { realpathSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

describe('API Integration Tests', () => {
  let app: express.Application;
  let httpServer: any;
  let io: Server;
  let testRepoPath: string;

  beforeEach(async () => {
    // Create test repo and resolve symlinks
    testRepoPath = realpathSync(createTestRepo());
    process.env.WORK_DIR = testRepoPath;

    // Setup express app
    app = express();
    app.use(express.json());
    
    // Setup Socket.io
    httpServer = createServer(app);
    io = new Server(httpServer);
    
    // Setup API routes
    setupApiRoutes(app, io);
  });

  afterEach(async () => {
    delete process.env.WORK_DIR;
    cleanupTestRepo(testRepoPath);
    httpServer.close();
  });

  describe('GET /api/worktrees', () => {
    it('should return worktrees list', async () => {
      const response = await request(app)
        .get('/api/worktrees')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]).toMatchObject({
        path: testRepoPath,
        branch: expect.any(String),
        isMain: true,
        isCurrent: true,
      });
    });

    it('should return 400 if not a git repository', async () => {
      // Create a temporary directory that is not a git repo
      const nonGitPath = realpathSync(mkdtempSync(join(tmpdir(), 'non-git-')));
      
      // Create a separate app instance with the non-git directory
      const testApp = express();
      testApp.use(express.json());
      const testHttpServer = createServer(testApp);
      const testIo = new Server(testHttpServer);
      
      // Set the environment variable for this test
      const originalWorkDir = process.env.WORK_DIR;
      process.env.WORK_DIR = nonGitPath;
      setupApiRoutes(testApp, testIo);
      
      try {
        const response = await request(testApp)
          .get('/api/worktrees')
          .expect(400);

        expect(response.body).toMatchObject({
          error: 'Not a git repository',
        });
      } finally {
        // Cleanup
        process.env.WORK_DIR = originalWorkDir;
        testHttpServer.close();
        rmSync(nonGitPath, { recursive: true, force: true });
      }
    });
  });

  describe('POST /api/worktrees', () => {
    it('should create a new worktree', async () => {
      const worktreePath = `${testRepoPath}-feature`;
      const response = await request(app)
        .post('/api/worktrees')
        .send({
          path: worktreePath,
          branch: 'feature/test',
        })
        .expect(200);

      expect(response.body).toMatchObject({ success: true });

      // Verify worktree was created
      const worktreesResponse = await request(app)
        .get('/api/worktrees')
        .expect(200);

      expect(worktreesResponse.body).toHaveLength(2);
      const createdWorktree = worktreesResponse.body.find((wt: any) => 
        wt.path.includes('feature') && wt.branch.includes('feature/test')
      );
      expect(createdWorktree).toBeDefined();
    });

    it('should return 400 if no commits in repository', async () => {
      // Create empty repo without any commits
      const emptyRepoPath = realpathSync(mkdtempSync(join(tmpdir(), 'empty-repo-')));
      
      try {
        execSync('git init', { cwd: emptyRepoPath });
        execSync('git config user.email "test@example.com"', { cwd: emptyRepoPath });
        execSync('git config user.name "Test User"', { cwd: emptyRepoPath });
        
        // Create a separate app instance with the empty repo
        const testApp = express();
        testApp.use(express.json());
        const testHttpServer = createServer(testApp);
        const testIo = new Server(testHttpServer);
        
        const originalWorkDir = process.env.WORK_DIR;
        process.env.WORK_DIR = emptyRepoPath;
        setupApiRoutes(testApp, testIo);

        const response = await request(testApp)
          .post('/api/worktrees')
          .send({
            path: 'test-worktree',
            branch: 'test-branch',
          })
          .expect(400);

        expect(response.body).toMatchObject({
          error: 'Repository has no commits. Please make at least one commit before creating worktrees.',
        });
        
        // Cleanup
        process.env.WORK_DIR = originalWorkDir;
        testHttpServer.close();
      } finally {
        cleanupTestRepo(emptyRepoPath);
      }
    });

    it('should return 400 if path already exists', async () => {
      const response = await request(app)
        .post('/api/worktrees')
        .send({
          path: testRepoPath,
          branch: 'feature/test',
        })
        .expect(400);

      expect(response.body.error).toContain('Path already exists');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/worktrees')
        .send({ path: 'test' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Path and branch are required',
      });
    });
  });

  describe('DELETE /api/worktrees', () => {
    it('should delete worktrees', async () => {
      // First create a worktree
      const worktreePath = `${testRepoPath}-feature`;
      await request(app)
        .post('/api/worktrees')
        .send({
          path: worktreePath,
          branch: 'feature/delete-test',
        })
        .expect(200);

      // Then delete it
      const response = await request(app)
        .delete('/api/worktrees')
        .send({
          paths: [worktreePath],
        })
        .expect(200);

      expect(response.body).toMatchObject({ success: true });

      // Verify it was deleted
      const worktreesResponse = await request(app)
        .get('/api/worktrees')
        .expect(200);

      expect(worktreesResponse.body).toHaveLength(1);
    });

    it('should return 400 if trying to delete main worktree', async () => {
      const response = await request(app)
        .delete('/api/worktrees')
        .send({
          paths: [testRepoPath],
        })
        .expect(400);

      expect(response.body.error).toContain('Cannot delete the main worktree');
    });

    it('should return 400 if paths array is empty', async () => {
      const response = await request(app)
        .delete('/api/worktrees')
        .send({ paths: [] })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Paths array is required',
      });
    });
  });

  describe('POST /api/worktrees/merge', () => {
    let featureWorktreePath: string;
    let mainBranch: string;

    beforeEach(async () => {
      // Create a feature worktree
      featureWorktreePath = `${testRepoPath}-feature`;
      await request(app)
        .post('/api/worktrees')
        .send({
          path: featureWorktreePath,
          branch: 'feature/merge-test',
        })
        .expect(200);

      // Get main branch name
      const worktreesResponse = await request(app)
        .get('/api/worktrees')
        .expect(200);

      mainBranch = worktreesResponse.body
        .find((wt: any) => wt.isMain)
        .branch.replace('refs/heads/', '');
    });

    it('should merge branches', async () => {
      const response = await request(app)
        .post('/api/worktrees/merge')
        .send({
          sourceBranch: 'feature/merge-test',
          targetBranch: mainBranch,
          deleteAfterMerge: false,
          useRebase: false,
        })
        .expect(200);

      expect(response.body).toMatchObject({ success: true });
    });

    it('should merge and delete source worktree', async () => {
      const response = await request(app)
        .post('/api/worktrees/merge')
        .send({
          sourceBranch: 'feature/merge-test',
          targetBranch: mainBranch,
          deleteAfterMerge: true,
          useRebase: false,
        })
        .expect(200);

      expect(response.body).toMatchObject({ success: true });

      // Verify worktree was deleted
      const worktreesResponse = await request(app)
        .get('/api/worktrees')
        .expect(200);

      expect(worktreesResponse.body).toHaveLength(1);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/worktrees/merge')
        .send({ sourceBranch: 'test' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Source branch and target branch are required',
      });
    });
  });
});