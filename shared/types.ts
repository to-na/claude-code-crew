export type SessionState = 'idle' | 'busy' | 'waiting_input';

export interface Session {
  id: string;
  worktreePath: string;
  state: SessionState;
  lastActivity: Date;
}

export interface Worktree {
  path: string;
  branch: string;
  isMain: boolean;
  isCurrent: boolean;
  session?: Session;
}

export interface CreateWorktreeRequest {
  path: string;
  branch: string;
  baseBranch?: string;
  isNewBranch?: boolean;
}

export interface DeleteWorktreeRequest {
  paths: string[];
}

export interface MergeWorktreeRequest {
  sourceBranch: string;
  targetBranch: string;
  deleteAfterMerge: boolean;
  useRebase: boolean;
}

export interface SocketEvents {
  // Client to Server
  'session:create': (worktreePath: string) => void;
  'session:input': (data: { sessionId: string; input: string }) => void;
  'session:resize': (data: { sessionId: string; cols: number; rows: number }) => void;
  'session:destroy': (sessionId: string) => void;

  // Server to Client
  'session:created': (session: Session) => void;
  'session:output': (data: { sessionId: string; data: string }) => void;
  'session:stateChanged': (session: Session) => void;
  'session:destroyed': (sessionId: string) => void;
  'session:restore': (data: { sessionId: string; history: string }) => void;
  'worktrees:updated': (worktrees: Worktree[]) => void;
}