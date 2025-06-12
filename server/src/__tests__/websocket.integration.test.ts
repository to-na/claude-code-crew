import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import { setupWebSocket } from '../websocket/index.js';
import { setupApiRoutes } from '../api/index.js';
import { createTestRepo, cleanupTestRepo, waitFor } from './test-helpers.js';

// Mock node-pty to avoid actual terminal creation
vi.mock('node-pty-prebuilt-multiarch', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn((callback: any) => {
      // Simulate some terminal output
      setTimeout(() => callback('Mock terminal initialized\r\n'), 100);
      setTimeout(() => callback('$ '), 200);
    }),
    onExit: vi.fn(),
    write: vi.fn((data: string) => {
      console.log('Mock PTY write:', data);
    }),
    resize: vi.fn(),
    kill: vi.fn(),
  })),
}));

describe('WebSocket Integration Tests', () => {
  let httpServer: any;
  let io: Server;
  let clientSocket: ClientSocket;
  let testRepoPath: string;
  let app: express.Application;
  const port = 3099; // Use a specific port for tests

  beforeEach(async () => {
    // Create test repo
    testRepoPath = createTestRepo();
    process.env.WORK_DIR = testRepoPath;

    // Setup express app
    app = express();
    app.use(express.json());
    
    // Setup server
    httpServer = createServer(app);
    io = new Server(httpServer, {
      cors: {
        origin: '*',
      },
    });
    
    // Setup routes
    setupApiRoutes(app, io);
    setupWebSocket(io);

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => {
        resolve();
      });
    });

    // Connect client
    clientSocket = ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      transports: ['websocket'],
    });

    // Wait for connection
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => {
        resolve();
      });
    });
  });

  afterEach(async () => {
    delete process.env.WORK_DIR;
    clientSocket.disconnect();
    io.close();
    httpServer.close();
    cleanupTestRepo(testRepoPath);
    vi.clearAllMocks();
  });

  describe('Connection', () => {
    it('should connect successfully', () => {
      expect(clientSocket.connected).toBe(true);
    });

    it('should receive initial worktrees on connection', async () => {
      // Create a fresh connection to receive the initial event
      const testClient = ioClient(`http://localhost:${port}`, {
        autoConnect: false,
        transports: ['websocket'],
      });

      const worktrees = await new Promise((resolve) => {
        testClient.on('worktrees:updated', (data) => {
          resolve(data);
        });
        testClient.connect();
      });

      testClient.disconnect();

      expect(worktrees).toBeInstanceOf(Array);
      expect(worktrees).toHaveLength(1);
    });
  });

  describe('Session Management', () => {
    it('should create a session', async () => {
      const sessionCreatedPromise = new Promise((resolve) => {
        clientSocket.on('session:created', (session) => {
          resolve(session);
        });
      });

      clientSocket.emit('session:create', testRepoPath);

      const session = await sessionCreatedPromise;

      expect(session).toMatchObject({
        id: expect.any(String),
        worktreePath: testRepoPath,
        state: expect.any(String),
        lastActivity: expect.any(String),
      });
    });

    it('should receive session output', async () => {
      // Create session first
      const sessionCreatedPromise = new Promise<any>((resolve) => {
        clientSocket.on('session:created', (session) => {
          resolve(session);
        });
      });

      clientSocket.emit('session:create', testRepoPath);
      const session = await sessionCreatedPromise;

      // Listen for output
      const outputPromise = new Promise((resolve) => {
        clientSocket.on('session:output', (data) => {
          resolve(data);
        });
      });

      const output = await outputPromise;

      expect(output).toMatchObject({
        sessionId: session.id,
        data: expect.any(String),
      });
    });

    it('should handle session input', async () => {
      // Create session first
      const sessionCreatedPromise = new Promise<any>((resolve) => {
        clientSocket.on('session:created', (session) => {
          resolve(session);
        });
      });

      clientSocket.emit('session:create', testRepoPath);
      const session = await sessionCreatedPromise;

      // Send input
      clientSocket.emit('session:input', {
        sessionId: session.id,
        input: 'echo test\n',
      });

      // The mock PTY should receive the input
      const { spawn } = await import('node-pty-prebuilt-multiarch');
      const mockSpawn = vi.mocked(spawn);
      
      await waitFor(() => {
        const mockPty = mockSpawn.mock.results[0]?.value;
        return mockPty?.write.mock.calls.length > 0;
      });

      const mockPty = mockSpawn.mock.results[0]?.value;
      expect(mockPty.write).toHaveBeenCalledWith('echo test\n');
    });

    it('should handle session resize', async () => {
      // Create session first
      const sessionCreatedPromise = new Promise<any>((resolve) => {
        clientSocket.on('session:created', (session) => {
          resolve(session);
        });
      });

      clientSocket.emit('session:create', testRepoPath);
      const session = await sessionCreatedPromise;

      // Send resize
      clientSocket.emit('session:resize', {
        sessionId: session.id,
        cols: 120,
        rows: 40,
      });

      // The mock PTY should receive the resize
      const { spawn } = await import('node-pty-prebuilt-multiarch');
      const mockSpawn = vi.mocked(spawn);
      
      await waitFor(() => {
        const mockPty = mockSpawn.mock.results[0]?.value;
        return mockPty?.resize.mock.calls.length > 0;
      });

      const mockPty = mockSpawn.mock.results[0]?.value;
      expect(mockPty.resize).toHaveBeenCalledWith(120, 40);
    });

    it('should destroy session', async () => {
      // Create session first
      const sessionCreatedPromise = new Promise<any>((resolve) => {
        clientSocket.on('session:created', (session) => {
          resolve(session);
        });
      });

      clientSocket.emit('session:create', testRepoPath);
      const session = await sessionCreatedPromise;

      // Listen for session destroyed event
      const sessionDestroyedPromise = new Promise((resolve) => {
        clientSocket.on('session:destroyed', (sessionId) => {
          resolve(sessionId);
        });
      });

      // Destroy session
      clientSocket.emit('session:destroy', session.id);

      const destroyedSessionId = await sessionDestroyedPromise;
      expect(destroyedSessionId).toBe(session.id);

      // The mock PTY should be killed
      const { spawn } = await import('node-pty-prebuilt-multiarch');
      const mockSpawn = vi.mocked(spawn);
      const mockPty = mockSpawn.mock.results[0]?.value;
      
      expect(mockPty.kill).toHaveBeenCalled();
    });
  });

  describe('Worktree Updates', () => {
    it('should emit worktrees:updated when worktree is created via API', async () => {
      let updateCount = 0;
      const updatesReceived: any[] = [];

      clientSocket.on('worktrees:updated', (worktrees) => {
        updateCount++;
        updatesReceived.push(worktrees);
      });

      // Create worktree via API
      const response = await fetch(`http://localhost:${port}/api/worktrees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${testRepoPath}-websocket-test`,
          branch: 'feature/websocket-test',
        }),
      });

      expect(response.ok).toBe(true);

      // Wait for the update event from the API call
      await waitFor(() => updateCount >= 1);

      // Should have received an update with 2 worktrees
      const lastUpdate = updatesReceived[updatesReceived.length - 1];
      expect(lastUpdate).toHaveLength(2);
      expect(lastUpdate.some((wt: any) => wt.branch.includes('websocket-test'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid session ID gracefully', async () => {
      // Send input to non-existent session
      clientSocket.emit('session:input', {
        sessionId: 'non-existent-session',
        input: 'test',
      });

      // Should not crash - just verify no error is thrown
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(clientSocket.connected).toBe(true);
    });
  });
});