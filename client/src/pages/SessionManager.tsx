import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  AppBar,
  Toolbar,
  Typography,
  Chip,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  FolderOpen,
  Add,
  Delete,
  Merge,
  Terminal,
  Circle,
  Code,
  Description,
} from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import { Worktree, Session } from '../../../shared/types';
import TerminalView from '../components/TerminalView';
import CreateWorktreeDialog from '../components/CreateWorktreeDialog';
import DeleteWorktreeDialog from '../components/DeleteWorktreeDialog';
import MergeWorktreeDialog from '../components/MergeWorktreeDialog';
import NotificationSettings from '../components/NotificationSettings';
import NotificationPermissionDialog from '../components/NotificationPermissionDialog';
import WorktreeTabs, { TabType } from '../components/WorktreeTabs';
import InstructionsViewer from '../components/InstructionsViewer';
import { NotificationService } from '../services/notificationService';
import { AutoEnterService } from '../services/autoEnterService';

const drawerWidth = 300;

const SessionManager: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [selectedWorktree, setSelectedWorktree] = useState<Worktree | null>(null);
  const [claudeSession, setClaudeSession] = useState<Session | null>(null);
  const [terminalSession, setTerminalSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('claude');
  const [hasInstructions, setHasInstructions] = useState(false);
  const previousStateRef = useRef<Map<string, string>>(new Map());
  const worktreesRef = useRef<Worktree[]>([]);
  const hasShownNotificationDialog = useRef(false);
  const lastAutoEnterTimeRef = useRef<Map<string, number>>(new Map());
  const notificationService = NotificationService.getInstance();
  const autoEnterService = AutoEnterService.getInstance();
  const autoEnterTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const hasRestoredSession = useRef(false);

  useEffect(() => {
    // Use relative URL so it connects to the same host serving the application
    const newSocket = io();
    setSocket(newSocket);
    socketRef.current = newSocket;

    newSocket.on('worktrees:updated', (updatedWorktrees: Worktree[]) => {
      // Check if worktrees actually changed to prevent unnecessary updates
      const currentPaths = worktreesRef.current.map(w => w.path).sort().join(',');
      const newPaths = updatedWorktrees.map(w => w.path).sort().join(',');
      const hasNewWorktrees = currentPaths !== newPaths;
      
      if (hasNewWorktrees) {
        console.log('[Client] Received worktrees:updated event with', updatedWorktrees.length, 'worktrees');
      }
      
      // Update worktrees state
      setWorktrees(updatedWorktrees);
      worktreesRef.current = updatedWorktrees;
      
      // Only initialize auto-enter settings for newly added worktrees
      if (hasNewWorktrees) {
        updatedWorktrees.forEach(worktree => {
          autoEnterService.addWorktree(worktree.path);
        });
      }
      
      // Extract sessions from worktrees and update session state
      const newSessions = new Map<string, Session>();
      updatedWorktrees.forEach(worktree => {
        if (worktree.session) {
          newSessions.set(worktree.session.id, worktree.session);
        }
      });
      
      if (newSessions.size > 0) {
        console.log('[Client] Found', newSessions.size, 'existing sessions from worktrees');
        setSessions(prev => {
          // Merge with existing sessions to preserve all session types
          const merged = new Map(prev);
          newSessions.forEach((session, id) => {
            merged.set(id, session);
          });
          return merged;
        });
      }
    });

    newSocket.on('sessions:list', (sessionsList: Session[]) => {
      console.log('[SessionManager] Received sessions:list event with', sessionsList.length, 'sessions');
      const newSessions = new Map<string, Session>();
      sessionsList.forEach(session => {
        newSessions.set(session.id, session);
      });
      setSessions(newSessions);
      
      // Update terminal and claude sessions for the selected worktree
      if (selectedWorktree) {
        const worktreeSessions = sessionsList.filter(s => s.worktreePath === selectedWorktree.path);
        const claude = worktreeSessions.find(s => s.type === 'claude');
        const terminal = worktreeSessions.find(s => s.type === 'terminal');
        
        if (claude) setClaudeSession(claude);
        if (terminal) setTerminalSession(terminal);
      }
    });

    newSocket.on('session:created', (session: Session) => {
      console.log('[SessionManager] Received session:created event:', {
        id: session.id,
        type: session.type,
        worktreePath: session.worktreePath,
        state: session.state
      });
      
      setSessions(prev => new Map(prev).set(session.id, session));
      
      if (session.type === 'claude') {
        setClaudeSession(session);
      } else if (session.type === 'terminal') {
        setTerminalSession(session);
      }
      
      // Track initial state
      previousStateRef.current.set(session.id, session.state);
      
      // Request restore if this is a claude session and we have history
      if (session.type === 'claude') {
        console.log('[SessionManager] Requesting restore for claude session:', session.id);
        newSocket.emit('session:restore', session.id);
      }
    });

    newSocket.on('session:stateChanged', (session: Session) => {
      console.log('[Client] Received session:stateChanged event:', session);
      console.log('[Client] Current worktrees:', worktreesRef.current);
      
      setSessions(prev => new Map(prev).set(session.id, session));
      
      if (session.type === 'claude') {
        setClaudeSession(session);
      } else if (session.type === 'terminal') {
        setTerminalSession(session);
      }
      
      // Handle notifications for state changes
      const worktree = worktreesRef.current.find(w => {
        const sessionsArray = Array.from(sessions.values());
        return sessionsArray.some(s => s.id === session.id && s.worktreePath === w.path);
      });
      console.log('[Client] Found worktree for session:', worktree);
      
      if (worktree) {
        const previousState = previousStateRef.current.get(session.id);
        console.log('[Client] Previous state:', previousState, 'New state:', session.state);
        
        if (previousState && previousState !== session.state) {
          console.log('[Client] State changed from', previousState, 'to', session.state, 'for worktree:', worktree.branch);
          
          // 通知機能
          notificationService.notifyStateChange(
            worktree.branch,
            session.state,
            previousState
          );
          
          // 自動Enter機能
          handleAutoEnter(session, worktree, previousState);
        }
        previousStateRef.current.set(session.id, session.state);
      } else {
        console.warn('[Client] No worktree found for session:', session.id);
      }
    });

    newSocket.on('session:destroyed', (sessionId: string) => {
      setSessions(prev => {
        const newSessions = new Map(prev);
        const session = newSessions.get(sessionId);
        if (session) {
          newSessions.delete(sessionId);
          
          if (session.type === 'claude') {
            setClaudeSession(null);
          } else if (session.type === 'terminal') {
            setTerminalSession(null);
          }
        }
        return newSessions;
      });
    });

    return () => {
      // クリーンアップ: すべてのタイマーをクリア
      autoEnterTimeoutRef.current.forEach(timeout => {
        clearTimeout(timeout);
      });
      autoEnterTimeoutRef.current.clear();
      
      newSocket.close();
      socketRef.current = null;
    };
  }, []); // Empty dependency array - only run once

  // Separate effect to update worktree and sessions when worktrees change
  useEffect(() => {
    if (selectedWorktree && worktrees.length > 0) {
      const updated = worktrees.find(w => w.path === selectedWorktree.path);
      if (updated) {
        setSelectedWorktree(updated);
        
        // Update terminal and claude sessions for the selected worktree
        const worktreeSessions = Array.from(sessions.values()).filter(s => s.worktreePath === updated.path);
        const claude = worktreeSessions.find(s => s.type === 'claude');
        const terminal = worktreeSessions.find(s => s.type === 'terminal');
        
        if (claude) setClaudeSession(claude);
        if (terminal) setTerminalSession(terminal);
      }
    }
  }, [worktrees, selectedWorktree?.path, sessions]);
  
  // Auto-restore session from localStorage when worktrees are loaded
  useEffect(() => {
    if (!hasRestoredSession.current && worktrees.length > 0 && socket) {
      const savedWorktreePath = localStorage.getItem('selectedWorktreePath');
      if (savedWorktreePath) {
        const savedWorktree = worktrees.find(w => w.path === savedWorktreePath);
        if (savedWorktree) {
          console.log('[Client] Auto-restoring session for worktree:', savedWorktreePath);
          hasRestoredSession.current = true;
          
          // Directly set the selected worktree
          setSelectedWorktree(savedWorktree);
          
          // Restore saved active tab or default to 'claude'
          const savedTab = localStorage.getItem(`activeTab_${savedWorktree.path}`) as TabType;
          const restoredTab = savedTab || 'claude';
          setActiveTab(restoredTab);
          console.log('[Client] Restoring active tab:', restoredTab);
          
          // Check if sessions exist for this worktree
          const worktreeSessions = Array.from(sessions.values()).filter(s => s.worktreePath === savedWorktree.path);
          const claudeExists = worktreeSessions.some(s => s.type === 'claude');
          const terminalExists = worktreeSessions.some(s => s.type === 'terminal');

          // Create Claude session if it doesn't exist
          if (!claudeExists && socket) {
            socket.emit('session:create', savedWorktree.path, 'claude');
          } else {
            // Set existing Claude session
            const claude = worktreeSessions.find(s => s.type === 'claude');
            if (claude) {
              setClaudeSession(claude);
            }
          }

          // Create or set terminal session
          if (!terminalExists && socket) {
            socket.emit('session:create', savedWorktree.path, 'terminal');
          } else {
            const terminal = worktreeSessions.find(s => s.type === 'terminal');
            if (terminal) {
              setTerminalSession(terminal);
            }
          }
          
          // Notify server about the active tab
          if (restoredTab === 'terminal' && terminalExists) {
            socket.emit('session:switchTab', { 
              worktreePath: savedWorktree.path, 
              sessionType: 'terminal' 
            });
          } else if (restoredTab === 'claude' && claudeExists) {
            socket.emit('session:switchTab', { 
              worktreePath: savedWorktree.path, 
              sessionType: 'claude' 
            });
          }
          
          // Check instructions file
          checkInstructionsFile(savedWorktree);
        }
      }
    }
  }, [worktrees, socket, sessions]);

  // 自動Enter機能の処理
  const handleAutoEnter = useCallback((session: Session, worktree: Worktree, previousState: string) => {
    // ターミナルセッションの場合はスキップ
    if (session.type === 'terminal') {
      return;
    }

    // waiting_input状態になった場合のみ処理
    if (session.state !== 'waiting_input') {
      // waiting_input以外の状態になった場合、pending中のタイマーをキャンセル
      const existingTimeout = autoEnterTimeoutRef.current.get(session.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        autoEnterTimeoutRef.current.delete(session.id);
        console.log('[AutoEnter] Cancelled pending auto-enter for session:', session.id);
      }
      return;
    }

    // 自動Enter設定をチェック
    if (!autoEnterService.shouldAutoEnter(worktree.path)) {
      console.log('[AutoEnter] Auto-enter disabled for worktree:', worktree.path);
      return;
    }

    // 連続実行防止: 最後の実行から5秒以内は実行しない
    const now = Date.now();
    const lastAutoEnterTime = lastAutoEnterTimeRef.current.get(session.id) || 0;
    const timeSinceLastAutoEnter = now - lastAutoEnterTime;
    const minInterval = 5000; // 5秒
    
    if (timeSinceLastAutoEnter < minInterval) {
      console.log(`[AutoEnter] Skipping auto-enter for session ${session.id} - too soon (${timeSinceLastAutoEnter}ms < ${minInterval}ms)`);
      return;
    }

    // busyからwaiting_inputへの変化の場合のみ実行（初期状態やidleからの変化は除外）
    if (previousState !== 'busy') {
      console.log(`[AutoEnter] Skipping auto-enter for session ${session.id} - not from busy state (was: ${previousState})`);
      return;
    }

    const delayMs = autoEnterService.getDelayMs();
    console.log('[AutoEnter] Scheduling auto-enter for session:', session.id, 'with delay:', delayMs + 'ms');
    
    // 既存のタイマーがあればキャンセル
    const existingTimeout = autoEnterTimeoutRef.current.get(session.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // 3秒後にEnterキーを送信
    const timeout = setTimeout(() => {
      const currentSocket = socketRef.current;
      
      if (currentSocket && currentSocket.connected) {
        console.log('[AutoEnter] ✅ Sending auto-enter (\\r) for session:', session.id);
        currentSocket.emit('session:input', {
          sessionId: session.id,
          input: '\r'
        });
        
        // 実行時刻を記録
        lastAutoEnterTimeRef.current.set(session.id, Date.now());
        
        // タイマーをクリーンアップ
        autoEnterTimeoutRef.current.delete(session.id);
      } else {
        console.log('[AutoEnter] ❌ Skipped auto-enter - socket unavailable or disconnected');
        console.log('[AutoEnter] Socket object exists:', !!currentSocket);
        console.log('[AutoEnter] Socket connected:', currentSocket?.connected);
        
        // Socket再接続を試行
        if (currentSocket && !currentSocket.connected) {
          console.log('[AutoEnter] Attempting to reconnect socket...');
          currentSocket.connect();
        }
      }
    }, delayMs);

    // タイマーを保存
    autoEnterTimeoutRef.current.set(session.id, timeout);
  }, [autoEnterService]);

  // 初回アクセス時の通知権限ダイアログ表示
  useEffect(() => {
    if (worktrees.length > 0 && !hasShownNotificationDialog.current) {
      const settings = notificationService.getSettings();
      if (settings.notificationsEnabled && 
          'Notification' in window && 
          Notification.permission === 'default') {
        setNotificationDialogOpen(true);
        hasShownNotificationDialog.current = true;
      }
    }
  }, [worktrees]);


  const handleSelectWorktree = useCallback((worktree: Worktree) => {
    setSelectedWorktree(worktree);
    setActiveTab('claude'); // Reset to claude tab when selecting a new worktree
    checkInstructionsFile(worktree);
    
    // Save selected worktree path to localStorage
    localStorage.setItem('selectedWorktreePath', worktree.path);

    // Check if sessions exist for this worktree
    const worktreeSessions = Array.from(sessions.values()).filter(s => s.worktreePath === worktree.path);
    const claudeExists = worktreeSessions.some(s => s.type === 'claude');

    if (!claudeExists && socket) {
      // Create Claude session if it doesn't exist
      socket.emit('session:create', worktree.path, 'claude');
    } else {
      // Set existing Claude session
      const claude = worktreeSessions.find(s => s.type === 'claude');
      if (claude) {
        setClaudeSession(claude);
        socket?.emit('session:setActive', worktree.path);
      }
    }

    // Always set terminal session state based on existing sessions
    const terminal = worktreeSessions.find(s => s.type === 'terminal');
    setTerminalSession(terminal || null);
    
    if (terminal) {
      // Request session restore to trigger scroll to bottom
      socket?.emit('session:restore', terminal.id);
    }
  }, [socket, sessions]);

  // Check if instructions file exists for the selected worktree
  const checkInstructionsFile = async (worktree: Worktree) => {
    try {
      const encodedPath = encodeURIComponent(worktree.path);
      const response = await fetch(`/api/worktrees/${encodedPath}/instructions`);
      const data = await response.json();
      setHasInstructions(data.success);
    } catch (error) {
      console.error('[SessionManager] Failed to check instructions file:', error);
      setHasInstructions(false);
    }
  };

  const handleTabChange = useCallback((tab: TabType) => {
    console.log('[SessionManager] handleTabChange:', tab, {
      selectedWorktree: selectedWorktree?.path,
      terminalSession: terminalSession?.id,
      socket: !!socket,
      socketConnected: socket?.connected
    });
    
    setActiveTab(tab);
    
    // Handle tab switching based on tab type
    if (selectedWorktree && socket && socket.connected) {
      if (tab === 'terminal') {
        // Create terminal session if it doesn't exist
        if (!terminalSession) {
          console.log('[SessionManager] Creating terminal session for:', selectedWorktree.path);
          socket.emit('session:create', selectedWorktree.path, 'terminal');
        } else {
          // Switch to existing terminal session
          console.log('[SessionManager] Switching to terminal session:', terminalSession.id);
          socket.emit('session:switchTab', { 
            worktreePath: selectedWorktree.path, 
            sessionType: 'terminal' 
          });
        }
      } else if (tab === 'claude') {
        // Switch to claude session
        const claudeSession = Array.from(sessions.values()).find(
          s => s.worktreePath === selectedWorktree.path && s.type === 'claude'
        );
        if (claudeSession) {
          console.log('[SessionManager] Switching to claude session:', claudeSession.id);
          socket.emit('session:switchTab', { 
            worktreePath: selectedWorktree.path, 
            sessionType: 'claude' 
          });
        }
      }
    }
    
    // Save active tab to localStorage
    if (selectedWorktree) {
      localStorage.setItem(`activeTab_${selectedWorktree.path}`, tab);
    }
  }, [selectedWorktree, terminalSession, socket, sessions]);

  const getStatusColor = useCallback((state?: string) => {
    switch (state) {
      case 'busy':
        return 'warning';
      case 'waiting_input':
        return 'info';
      case 'idle':
        return 'success';
      default:
        return 'default';
    }
  }, []);

  const getWorktreeStatusIcon = useCallback((worktreePath: string) => {
    const worktreeSessions = Array.from(sessions.values()).filter(s => s.worktreePath === worktreePath);
    const claudeSession = worktreeSessions.find(s => s.type === 'claude');
    
    if (!claudeSession) return <FolderOpen />;
    
    const color = getStatusColor(claudeSession.state);
    const statusText = claudeSession.state ? claudeSession.state.replace('_', ' ') : '';

    return (
      <Tooltip title={`Claude Code - ${statusText}`}>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <Code />
          <Circle
            sx={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              fontSize: 12,
              color: `${color}.main`,
            }}
          />
        </Box>
      </Tooltip>
    );
  }, [getStatusColor, sessions]);

  // キーボードショートカットの設定
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+1: Claude Code tab
      if (event.ctrlKey && event.key === '1') {
        event.preventDefault();
        if (selectedWorktree) {
          setActiveTab('claude');
        }
      }
      // Ctrl+2: Terminal tab
      else if (event.ctrlKey && event.key === '2') {
        event.preventDefault();
        if (selectedWorktree) {
          handleTabChange('terminal');
        }
      }
      // Ctrl+3: Instructions tab (if available)
      else if (event.ctrlKey && event.key === '3') {
        event.preventDefault();
        if (selectedWorktree && hasInstructions) {
          setActiveTab('instructions');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWorktree, hasInstructions, handleTabChange]);

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
        }}
      >
        <Toolbar>
          {activeTab === 'terminal' ? (
            <Terminal sx={{ mr: 2 }} />
          ) : activeTab === 'claude' ? (
            <Code sx={{ mr: 2 }} />
          ) : (
            <Description sx={{ mr: 2 }} />
          )}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {selectedWorktree ? (
              <>
                {selectedWorktree.branch}
                {activeTab !== 'instructions' && (
                  <Typography variant="caption" sx={{ ml: 1, opacity: 0.7 }}>
                    ({activeTab === 'terminal' ? 'Terminal' : 'Claude Code'})
                  </Typography>
                )}
              </>
            ) : (
              'Claude Code Crew'
            )}
          </Typography>
          {((activeTab === 'claude' && claudeSession) || (activeTab === 'terminal' && terminalSession)) && (
            <Chip
              label={(activeTab === 'claude' ? claudeSession : terminalSession)?.state.replace('_', ' ')}
              color={getStatusColor((activeTab === 'claude' ? claudeSession : terminalSession)?.state)}
              size="small"
            />
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar>
          <Typography variant="h6" noWrap>
            Worktrees
          </Typography>
        </Toolbar>
        <Divider />
        <List>
          {worktrees.map((worktree) => (
            <ListItem key={worktree.path} disablePadding>
              <ListItemButton
                selected={selectedWorktree?.path === worktree.path}
                onClick={() => handleSelectWorktree(worktree)}
              >
                <ListItemIcon>
                  {getWorktreeStatusIcon(worktree.path)}
                </ListItemIcon>
                <ListItemText
                  primary={worktree.branch}
                  secondary={worktree.path}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setCreateDialogOpen(true)}>
              <ListItemIcon>
                <Add />
              </ListItemIcon>
              <ListItemText primary="Create Worktree" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setDeleteDialogOpen(true)}>
              <ListItemIcon>
                <Delete />
              </ListItemIcon>
              <ListItemText primary="Delete Worktree" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setMergeDialogOpen(true)}>
              <ListItemIcon>
                <Merge />
              </ListItemIcon>
              <ListItemText primary="Merge Worktree" />
            </ListItemButton>
          </ListItem>
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Divider />
        <NotificationSettings variant="inline" worktrees={worktrees} />
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toolbar />
        {selectedWorktree ? (
          <>
            <WorktreeTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              hasInstructions={hasInstructions}
            />
            {activeTab === 'claude' ? (
              claudeSession && socket ? (
                <TerminalView
                  session={claudeSession}
                  socket={socket}
                />
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <Typography variant="h6" color="textSecondary">
                    Starting Claude Code session...
                  </Typography>
                </Box>
              )
            ) : activeTab === 'terminal' ? (
              terminalSession && socket ? (
                <TerminalView
                  session={terminalSession}
                  socket={socket}
                />
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <Typography variant="h6" color="textSecondary">
                    Starting Terminal session...
                  </Typography>
                </Box>
              )
            ) : activeTab === 'instructions' ? (
              <InstructionsViewer
                worktreePath={selectedWorktree.path}
                worktreeName={selectedWorktree.branch}
              />
            ) : null}
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Typography variant="h5" color="textSecondary">
              Select a worktree to start a Claude Code session
            </Typography>
          </Box>
        )}
      </Box>

      <CreateWorktreeDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
      <DeleteWorktreeDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        worktrees={worktrees}
      />
      <MergeWorktreeDialog
        open={mergeDialogOpen}
        onClose={() => setMergeDialogOpen(false)}
        worktrees={worktrees}
      />
      <NotificationPermissionDialog
        open={notificationDialogOpen}
        onClose={() => setNotificationDialogOpen(false)}
      />
    </Box>
  );
};

export default SessionManager;