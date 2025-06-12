import { Server, Socket } from 'socket.io';
import { SessionManager } from '../services/sessionManager.js';
import { WorktreeService } from '../services/worktreeService.js';
import { Session, Worktree } from '../../../shared/types.js';

export function setupWebSocket(io: Server, sessionManager: SessionManager) {
  const worktreeService = new WorktreeService(process.env.WORK_DIR);

  // Update worktrees with session info
  const getWorktreesWithSessions = (): Worktree[] => {
    const worktrees = worktreeService.getWorktrees();
    const sessions = sessionManager.getAllSessions();
    
    console.log(`[WebSocket] Getting worktrees with sessions: ${worktrees.length} worktrees, ${sessions.length} sessions`);
    
    return worktrees.map(worktree => {
      const session = sessions.find(s => s.worktreePath === worktree.path);
      return {
        ...worktree,
        session: session || undefined,
      };
    });
  };

  // Session manager event handlers
  sessionManager.on('sessionCreated', (session: Session) => {
    io.emit('session:created', session);
    io.emit('worktrees:updated', getWorktreesWithSessions());
  });

  sessionManager.on('sessionData', (session: Session, data: string) => {
    io.emit('session:output', { sessionId: session.id, data });
  });

  sessionManager.on('sessionStateChanged', (session: Session) => {
    io.emit('session:stateChanged', session);
    io.emit('worktrees:updated', getWorktreesWithSessions());
  });

  sessionManager.on('sessionDestroyed', (session: Session) => {
    io.emit('session:destroyed', session.id);
    io.emit('worktrees:updated', getWorktreesWithSessions());
  });

  sessionManager.on('sessionRestore', (session: any) => {
    if (session.outputHistory && session.outputHistory.length > 0) {
      const history = session.outputHistory
        .map((buf: Buffer) => buf.toString('utf8'))
        .join('');
      console.log(`Sending restore data for session ${session.id}, history length: ${history.length} characters`);
      io.emit('session:restore', { sessionId: session.id, history });
    } else {
      console.log(`No history available for session ${session.id}`);
    }
  });

  // Socket connection handler
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Send initial data
    socket.emit('worktrees:updated', getWorktreesWithSessions());

    // Handle session creation
    socket.on('session:create', (worktreePath: string) => {
      try {
        const session = sessionManager.createSession(worktreePath);
        sessionManager.setSessionActive(worktreePath, true);
      } catch (error) {
        console.error('Failed to create session:', error);
        socket.emit('error', { 
          message: error instanceof Error ? error.message : 'Failed to create session' 
        });
      }
    });

    // Handle session input
    socket.on('session:input', ({ sessionId, input }) => {
      try {
        sessionManager.writeToSession(sessionId, input);
      } catch (error) {
        console.error('Failed to write to session:', error);
      }
    });

    // Handle session resize
    socket.on('session:resize', ({ sessionId, cols, rows }) => {
      try {
        sessionManager.resizeSession(sessionId, cols, rows);
      } catch (error) {
        console.error('Failed to resize session:', error);
      }
    });

    // Handle client-requested session restore
    socket.on('session:restore', (sessionId: string) => {
      try {
        const session = sessionManager.getSessionById(sessionId);
        if (session && session.outputHistory && session.outputHistory.length > 0) {
          const history = session.outputHistory
            .map((buf: Buffer) => buf.toString('utf8'))
            .join('');
          console.log(`Restoring session ${sessionId} with ${history.length} characters of history`);
          socket.emit('session:restore', { sessionId: session.id, history });
        } else {
          console.log(`No history available for session ${sessionId}`);
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    });

    // Handle session activation (switching between existing sessions)
    socket.on('session:setActive', (worktreePath: string) => {
      try {
        const sessions = sessionManager.getAllSessions();
        
        // Deactivate all sessions first
        sessions.forEach(session => {
          sessionManager.setSessionActive(session.worktreePath, false);
        });
        
        // Activate the selected session (this will automatically emit sessionRestore)
        console.log(`Setting session active for worktree: ${worktreePath}`);
        sessionManager.setSessionActive(worktreePath, true);
      } catch (error) {
        console.error('Failed to set session active:', error);
        socket.emit('error', { 
          message: error instanceof Error ? error.message : 'Failed to activate session' 
        });
      }
    });

    // Handle session destruction
    socket.on('session:destroy', (sessionId: string) => {
      try {
        const sessions = sessionManager.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
          sessionManager.destroySession(session.worktreePath);
        }
      } catch (error) {
        console.error('Failed to destroy session:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Cleanup on server shutdown
  process.on('SIGINT', () => {
    sessionManager.destroy();
    process.exit();
  });

  process.on('SIGTERM', () => {
    sessionManager.destroy();
    process.exit();
  });
}