import React, { useState, useEffect, useRef } from 'react';
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
  const previousStateRef = useRef<Map<string, string>>(new Map());
  const worktreesRef = useRef<Worktree[]>([]);
  const hasShownNotificationDialog = useRef(false);
  const notificationService = NotificationService.getInstance();
  const autoEnterService = AutoEnterService.getInstance();
  const autoEnterTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('worktrees:updated', (updatedWorktrees: Worktree[]) => {
      console.log('[Client] Received worktrees:updated event with', updatedWorktrees.length, 'worktrees');
      // Force React to detect the change by creating a new array
      setWorktrees([...updatedWorktrees]);
      // Update ref for use in event handlers
      worktreesRef.current = updatedWorktrees;
      
      // ワークツリーリストが更新されたときに自動Enter設定を初期化
      updatedWorktrees.forEach(worktree => {
        autoEnterService.addWorktree(worktree.path);
      });
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
    };
  }, []); // Empty dependency array - only run once

  // Separate effect to update worktree when worktrees change
  useEffect(() => {
    if (selectedWorktree && worktrees.length > 0) {
      const updated = worktrees.find(w => w.path === selectedWorktree.path);
      if (updated) {
        setSelectedWorktree(updated);
        if (updated.session) {
          setActiveSession(updated.session);
        }
      }
    }
  }, [worktrees, selectedWorktree]);

  // 自動Enter機能の処理
  const handleAutoEnter = (session: Session, worktree: Worktree, _previousState: string) => {
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

    console.log('[AutoEnter] Scheduling auto-enter for session:', session.id);
    const delayMs = autoEnterService.getDelayMs();
    
    // 既存のタイマーがあればキャンセル
    const existingTimeout = autoEnterTimeoutRef.current.get(session.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // 遅延後にEnterキーを送信
    const timeout = setTimeout(() => {
      if (socket && session.state === 'waiting_input') {
        console.log('[AutoEnter] Sending auto-enter for session:', session.id);
        socket.emit('session:input', { 
          sessionId: session.id, 
          input: '\r' 
        });
        
        // タイマーをクリーンアップ
        autoEnterTimeoutRef.current.delete(session.id);
      } else {
        console.log('[AutoEnter] Skipped auto-enter - session state changed or socket unavailable');
      }
    }, delayMs);

    // タイマーを保存
    autoEnterTimeoutRef.current.set(session.id, timeout);
  };

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

  const handleSelectWorktree = (worktree: Worktree) => {
    setSelectedWorktree(worktree);

    if (!worktree.session && socket) {
      // Create a new session for this worktree
      socket.emit('session:create', worktree.path);
    } else if (worktree.session && socket) {
      // Activate existing session on server and client
      socket.emit('session:setActive', worktree.path);
      setActiveSession(worktree.session);
    }
  };

  const getStatusColor = (state?: string) => {
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
  };

  const getStatusIcon = (state?: string) => {
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
  };

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
        {activeSession && socket ? (
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