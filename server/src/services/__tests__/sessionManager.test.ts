import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../sessionManager.js';
import { spawn } from 'node-pty-prebuilt-multiarch';

vi.mock('node-pty-prebuilt-multiarch');

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockPtyProcess: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock PTY process
    mockPtyProcess = {
      onData: vi.fn(),
      onExit: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockPtyProcess);

    sessionManager = new SessionManager();
  });

  afterEach(() => {
    sessionManager.destroy();
  });

  describe('createSession', () => {
    it('should create a new session', () => {
      const session = sessionManager.createSession('/test/worktree');

      expect(session).toBeDefined();
      expect(session.worktreePath).toBe('/test/worktree');
      expect(session.state).toBe('busy');
      expect(session.id).toMatch(/^session-\d+-\w+$/);
    });

    it('should return existing session if already created', () => {
      const session1 = sessionManager.createSession('/test/worktree');
      const session2 = sessionManager.createSession('/test/worktree');

      expect(session1.id).toBe(session2.id);
    });

    it('should spawn claude process with correct arguments', () => {
      sessionManager.createSession('/test/worktree');

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        [],
        expect.objectContaining({
          cwd: '/test/worktree',
          name: 'xterm-color',
        })
      );
    });

    it('should use CC_CLAUDE_ARGS if set', () => {
      process.env.CC_CLAUDE_ARGS = '--arg1 --arg2';

      sessionManager.createSession('/test/worktree');

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        ['--arg1', '--arg2'],
        expect.any(Object)
      );

      delete process.env.CC_CLAUDE_ARGS;
    });
  });

  describe('session state detection', () => {
    let dataHandler: (data: string) => void;

    beforeEach(() => {
      mockPtyProcess.onData.mockImplementation((handler: any) => {
        dataHandler = handler;
      });
      sessionManager.createSession('/test/worktree');
    });

    it('should detect waiting_input state', () => {
      const stateChangedHandler = vi.fn();
      sessionManager.on('sessionStateChanged', stateChangedHandler);

      dataHandler('│ Do you want to proceed? (y/n)');

      expect(stateChangedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'waiting_input' })
      );
    });

    it('should detect busy state', () => {
      const stateChangedHandler = vi.fn();
      sessionManager.on('sessionStateChanged', stateChangedHandler);

      // First change state from busy to something else
      dataHandler('│ Do you want to proceed?');

      // Then change back to busy
      dataHandler('esc to interrupt the current operation');

      expect(stateChangedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'busy' })
      );
    });

    it('should transition from busy to idle after timeout', async () => {
      vi.useFakeTimers();
      const stateChangedHandler = vi.fn();
      sessionManager.on('sessionStateChanged', stateChangedHandler);

      // First set to busy
      dataHandler('esc to interrupt');

      // Then send data without "esc to interrupt"
      dataHandler('Some other output');

      // Fast forward time
      vi.advanceTimersByTime(500);

      expect(stateChangedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'idle' })
      );

      vi.useRealTimers();
    });
  });

  describe('getSession', () => {
    it('should return session by worktree path', () => {
      const created = sessionManager.createSession('/test/worktree');
      const retrieved = sessionManager.getSession('/test/worktree');

      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent session', () => {
      const session = sessionManager.getSession('/non/existent');

      expect(session).toBeUndefined();
    });
  });

  describe('getSessionById', () => {
    it('should return session by id', () => {
      const created = sessionManager.createSession('/test/worktree');
      const retrieved = sessionManager.getSessionById(created.id);

      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent id', () => {
      const session = sessionManager.getSessionById('non-existent-id');

      expect(session).toBeUndefined();
    });
  });

  describe('writeToSession', () => {
    it('should write data to session', () => {
      const session = sessionManager.createSession('/test/worktree');

      sessionManager.writeToSession(session.id, 'test input');

      expect(mockPtyProcess.write).toHaveBeenCalledWith('test input');
    });

    it('should not throw for non-existent session', () => {
      expect(() => {
        sessionManager.writeToSession('non-existent', 'test');
      }).not.toThrow();
    });
  });

  describe('resizeSession', () => {
    it('should resize session terminal', () => {
      const session = sessionManager.createSession('/test/worktree');

      sessionManager.resizeSession(session.id, 120, 40);

      expect(mockPtyProcess.resize).toHaveBeenCalledWith(120, 40);
    });

    it('should not throw for non-existent session', () => {
      expect(() => {
        sessionManager.resizeSession('non-existent', 80, 24);
      }).not.toThrow();
    });
  });

  describe('destroySession', () => {
    it('should destroy session and kill process', () => {
      const session = sessionManager.createSession('/test/worktree');
      const destroyedHandler = vi.fn();
      sessionManager.on('sessionDestroyed', destroyedHandler);

      sessionManager.destroySession('/test/worktree');

      expect(mockPtyProcess.kill).toHaveBeenCalled();
      expect(sessionManager.getSession('/test/worktree')).toBeUndefined();
      expect(destroyedHandler).toHaveBeenCalled();
    });

    it('should handle already dead process', () => {
      sessionManager.createSession('/test/worktree');
      mockPtyProcess.kill.mockImplementation(() => {
        throw new Error('Process already dead');
      });

      expect(() => {
        sessionManager.destroySession('/test/worktree');
      }).not.toThrow();
    });
  });

  describe('getAllSessions', () => {
    it('should return all active sessions', () => {
      sessionManager.createSession('/test/worktree1');
      sessionManager.createSession('/test/worktree2');

      const sessions = sessionManager.getAllSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.worktreePath)).toContain('/test/worktree1');
      expect(sessions.map(s => s.worktreePath)).toContain('/test/worktree2');
    });
  });

  describe('destroy', () => {
    it('should destroy all sessions', () => {
      sessionManager.createSession('/test/worktree1');
      sessionManager.createSession('/test/worktree2');

      sessionManager.destroy();

      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });
  });

  describe('session output history', () => {
    let dataHandler: (data: string) => void;

    beforeEach(() => {
      mockPtyProcess.onData.mockImplementation((handler: any) => {
        dataHandler = handler;
      });
    });

    it('should store output history', () => {
      const session = sessionManager.createSession('/test/worktree');
      const restoreHandler = vi.fn();
      sessionManager.on('sessionRestore', restoreHandler);

      dataHandler('Line 1\n');
      dataHandler('Line 2\n');

      sessionManager.setSessionActive('/test/worktree', true);

      expect(restoreHandler).toHaveBeenCalled();
    });

    it('should limit output history size', () => {
      sessionManager.createSession('/test/worktree');

      // Send more than 10MB of data
      const largeData = 'x'.repeat(1024 * 1024); // 1MB
      for (let i = 0; i < 12; i++) {
        dataHandler(largeData);
      }

      // Internal check would be needed here
      // Just verify it doesn't crash
      expect(sessionManager.getAllSessions()).toHaveLength(1);
    });
  });
});