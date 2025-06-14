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
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('terminal');
  const [hasInstructions, setHasInstructions] = useState(false);
  const previousStateRef = useRef<Map<string, string>>(new Map());
  const worktreesRef = useRef<Worktree[]>([]);
  const hasShownNotificationDialog = useRef(false);
  const lastAutoEnterTimeRef = useRef<Map<string, number>>(new Map());
  const notificationService = NotificationService.getInstance();
  const autoEnterService = AutoEnterService.getInstance();
  const autoEnterTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
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
    });

    newSocket.on('session:created', (session: Session) => {
      setActiveSession(session);
      // Track initial state
      previousStateRef.current.set(session.id, session.state);
    });

    newSocket.on('session:stateChanged', (session: Session) => {
      console.log('[Client] Received session:stateChanged event:', session);
      console.log('[Client] Current worktrees:', worktreesRef.current);
      
      setActiveSession(prevSession => {
        if (prevSession && session.id === prevSession.id) {
          return session;
        }
        return prevSession;
      });
      
      // Handle notifications for state changes
      const worktree = worktreesRef.current.find(w => w.session?.id === session.id);
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
      setActiveSession(prevSession => {
        if (prevSession && sessionId === prevSession.id) {
          return null;
        }
        return prevSession;
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

  // Separate effect to update worktree when worktrees change
  useEffect(() => {
    if (selectedWorktree && worktrees.length > 0) {
      const updated = worktrees.find(w => w.path === selectedWorktree.path);
      if (updated && (
        updated.session?.id !== selectedWorktree.session?.id ||
        updated.session?.state !== selectedWorktree.session?.state
      )) {
        setSelectedWorktree(updated);
        if (updated.session) {
          setActiveSession(updated.session);
        }
      }
    }
  }, [worktrees, selectedWorktree?.path, selectedWorktree?.session?.id, selectedWorktree?.session?.state]);

  // 自動Enter機能の処理
  const handleAutoEnter = useCallback((session: Session, worktree: Worktree, previousState: string) => {
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
    setActiveTab('terminal'); // Reset to terminal tab when selecting a new worktree
    checkInstructionsFile(worktree);

    if (!worktree.session && socket) {
      // Create a new session for this worktree
      socket.emit('session:create', worktree.path);
    } else if (worktree.session && socket) {
      // Activate existing session on server and client
      socket.emit('session:setActive', worktree.path);
      setActiveSession(worktree.session);
    }
  }, [socket]);

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
    setActiveTab(tab);
  }, []);

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

  const getStatusIcon = useCallback((state?: string) => {
    const color = getStatusColor(state);
    const statusText = state ? state.replace('_', ' ') : '';

    return (
      <Tooltip title={statusText}>
        <Circle
          sx={{
            fontSize: 20,
            color: `${color}.main`,
          }}
        />
      </Tooltip>
    );
  }, [getStatusColor]);

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
          <Terminal sx={{ mr: 2 }} />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {selectedWorktree ? selectedWorktree.branch : 'Claude Code Crew'}
          </Typography>
          {activeSession && (
            <Chip
              label={activeSession.state.replace('_', ' ')}
              color={getStatusColor(activeSession.state)}
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
                  {worktree.session ? (
                    getStatusIcon(worktree.session.state)
                  ) : (
                    <FolderOpen />
                  )}
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
            {activeTab === 'terminal' ? (
              activeSession && socket ? (
                <TerminalView
                  session={activeSession}
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