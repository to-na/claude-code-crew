import { spawn, IPty } from 'node-pty-prebuilt-multiarch';
import { EventEmitter } from 'events';
import { Session, SessionState, Worktree } from '../../../shared/types.js';

interface InternalSession extends Session {
  process: IPty;
  output: string[];
  outputHistory: Buffer[];
  isActive: boolean;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, InternalSession> = new Map();
  private waitingWithBottomBorder: Map<string, boolean> = new Map();
  private busyTimers: Map<string, NodeJS.Timeout> = new Map();

  private stripAnsi(str: string): string {
    return str
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07]*\x07/g, '')
      .replace(/\x1b[PX^_].*?\x1b\\/g, '')
      .replace(/\x1b\[\?[0-9;]*[hl]/g, '')
      .replace(/\x1b[>=]/g, '')
      .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
      .replace(/\r/g, '')
      .replace(/^[0-9;]+m/gm, '')
      .replace(/[0-9]+;[0-9]+;[0-9;]+m/g, '');
  }

  private includesPromptBoxBottomBorder(str: string): boolean {
    const patterns = [
      /└─+┘/,
      /╰─+╯/,
      /┗━+┛/,
      /╚═+╝/,
    ];
    return patterns.some(pattern => pattern.test(str));
  }

  private detectSessionState(
    cleanData: string,
    currentState: SessionState,
    sessionId: string,
  ): SessionState {
    const hasBottomBorder = this.includesPromptBoxBottomBorder(cleanData);
    const hasWaitingPrompt =
      cleanData.includes('│ Do you want') ||
      cleanData.includes('│ Would you like') ||
      cleanData.includes('Do you want') ||
      cleanData.includes('Would you like') ||
      cleanData.includes('Continue?') ||
      cleanData.includes('Proceed?') ||
      cleanData.includes('(y/n)') ||
      cleanData.includes('(Y/n)') ||
      cleanData.includes('[y/N]') ||
      cleanData.includes('YES') ||
      cleanData.includes('NO') ||
      cleanData.includes('[Y/n]') ||
      cleanData.includes('1. Yes') ||
      cleanData.includes('2. No');
    const wasWaitingWithBottomBorder =
      this.waitingWithBottomBorder.get(sessionId) || false;
    const hasEscToInterrupt = cleanData
      .toLowerCase()
      .includes('esc to interrupt');

    let newState = currentState;

    if (hasWaitingPrompt) {
      console.log('[SessionManager] Detected waiting prompt in output:', cleanData.substring(0, 100) + '...');
      newState = 'waiting_input';
      if (hasBottomBorder) {
        this.waitingWithBottomBorder.set(sessionId, true);
      } else {
        this.waitingWithBottomBorder.set(sessionId, false);
      }
      const existingTimer = this.busyTimers.get(sessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.busyTimers.delete(sessionId);
      }
    } else if (
      currentState === 'waiting_input' &&
      hasBottomBorder &&
      !hasWaitingPrompt &&
      !wasWaitingWithBottomBorder
    ) {
      newState = 'waiting_input';
      this.waitingWithBottomBorder.set(sessionId, true);
      const existingTimer = this.busyTimers.get(sessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.busyTimers.delete(sessionId);
      }
    } else if (hasEscToInterrupt) {
      newState = 'busy';
      this.waitingWithBottomBorder.set(sessionId, false);
      const existingTimer = this.busyTimers.get(sessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.busyTimers.delete(sessionId);
      }
    } else if (currentState === 'busy' && !hasEscToInterrupt) {
      if (!this.busyTimers.has(sessionId)) {
        const timer = setTimeout(() => {
          const session = this.sessions.get(sessionId);
          if (session && session.state === 'busy') {
            session.state = 'idle';
            this.emit('sessionStateChanged', session);
          }
          this.busyTimers.delete(sessionId);
        }, 500);
        this.busyTimers.set(sessionId, timer);
      }
      newState = 'busy';
    }

    return newState;
  }

  createSession(worktreePath: string): Session {
    const existing = this.sessions.get(worktreePath);
    if (existing) {
      return {
        id: existing.id,
        worktreePath: existing.worktreePath,
        state: existing.state,
        lastActivity: existing.lastActivity,
      };
    }

    const id = `session-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const claudeArgs = process.env['CC_CLAUDE_ARGS']
      ? process.env['CC_CLAUDE_ARGS'].split(' ')
      : [];

    const ptyProcess = spawn('claude', claudeArgs, {
      name: 'xterm-color',
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
      cwd: worktreePath,
      env: process.env as { [key: string]: string },
    });

    const session: InternalSession = {
      id,
      worktreePath,
      process: ptyProcess,
      state: 'busy',
      output: [],
      outputHistory: [],
      lastActivity: new Date(),
      isActive: false,
    };

    this.setupBackgroundHandler(session);
    this.sessions.set(worktreePath, session);
    this.emit('sessionCreated', session);

    return {
      id: session.id,
      worktreePath: session.worktreePath,
      state: session.state,
      lastActivity: session.lastActivity,
    };
  }

  private setupBackgroundHandler(session: InternalSession): void {
    session.process.onData((data: string) => {
      const buffer = Buffer.from(data, 'utf8');
      session.outputHistory.push(buffer);

      const MAX_HISTORY_SIZE = 10 * 1024 * 1024;
      let totalSize = session.outputHistory.reduce(
        (sum, buf) => sum + buf.length,
        0,
      );
      while (totalSize > MAX_HISTORY_SIZE && session.outputHistory.length > 0) {
        const removed = session.outputHistory.shift();
        if (removed) {
          totalSize -= removed.length;
        }
      }

      session.output.push(data);
      if (session.output.length > 100) {
        session.output.shift();
      }

      session.lastActivity = new Date();

      const cleanData = this.stripAnsi(data);

      if (!cleanData.trim()) {
        if (session.isActive) {
          this.emit('sessionData', session, data);
        }
        return;
      }

      const oldState = session.state;
      const newState = this.detectSessionState(
        cleanData,
        oldState,
        session.worktreePath,
      );

      if (newState !== oldState) {
        session.state = newState;
        this.emit('sessionStateChanged', session);
      }

      if (session.isActive) {
        this.emit('sessionData', session, data);
      }
    });

    session.process.onExit(() => {
      session.state = 'idle';
      this.emit('sessionStateChanged', session);
      this.destroySession(session.worktreePath);
      this.emit('sessionExit', session);
    });
  }

  getSession(worktreePath: string): InternalSession | undefined {
    return this.sessions.get(worktreePath);
  }

  getSessionById(sessionId: string): InternalSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.id === sessionId) {
        return session;
      }
    }
    return undefined;
  }

  setSessionActive(worktreePath: string, active: boolean): void {
    const session = this.sessions.get(worktreePath);
    if (session) {
      session.isActive = active;

      if (active && session.outputHistory.length > 0) {
        console.log(`Restoring session ${session.id} with ${session.outputHistory.length} history items`);
        this.emit('sessionRestore', session);
      } else if (active) {
        console.log(`Session ${session.id} activated but no history to restore`);
      }
    }
  }

  writeToSession(sessionId: string, data: string): void {
    const session = this.getSessionById(sessionId);
    if (session) {
      session.process.write(data);
    }
  }

  resizeSession(sessionId: string, cols: number, rows: number): void {
    const session = this.getSessionById(sessionId);
    if (session) {
      session.process.resize(cols, rows);
    }
  }

  destroySession(worktreePath: string): void {
    const session = this.sessions.get(worktreePath);
    if (session) {
      try {
        session.process.kill();
      } catch (_error) {
        // Process might already be dead
      }
      const timer = this.busyTimers.get(worktreePath);
      if (timer) {
        clearTimeout(timer);
        this.busyTimers.delete(worktreePath);
      }
      this.sessions.delete(worktreePath);
      this.waitingWithBottomBorder.delete(session.id);
      this.emit('sessionDestroyed', session);
    }
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      worktreePath: session.worktreePath,
      state: session.state,
      lastActivity: session.lastActivity,
    }));
  }

  destroy(): void {
    for (const worktreePath of this.sessions.keys()) {
      this.destroySession(worktreePath);
    }
  }
}