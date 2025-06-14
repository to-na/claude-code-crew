import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import {
  Notifications,
  VolumeUp,
} from '@mui/icons-material';
import { NotificationService } from '../services/notificationService';

interface NotificationPermissionDialogProps {
  open: boolean;
  onClose: () => void;
}

const NotificationPermissionDialog: React.FC<NotificationPermissionDialogProps> = ({ open, onClose }) => {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const notificationService = NotificationService.getInstance();

  const handleEnableNotifications = async () => {
    const granted = await notificationService.requestNotificationPermissionWithUserAction();
    setPermissionGranted(granted);
    
    if (granted) {
      // 通知権限が取得できた場合、テスト通知を送信
      setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Claude Crew', {
            body: '🎉 通知が有効になりました！セッションの状態変化をお知らせします。',
            icon: '/favicon.ico',
            tag: 'welcome-notification',
          });
        }
      }, 500);
      
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  const handleSkip = () => {
    // 通知を無効に設定
    const currentSettings = notificationService.getSettings();
    notificationService.saveSettings({
      ...currentSettings,
      notificationsEnabled: false,
    });
    onClose();
  };

  useEffect(() => {
    if (open) {
      setPermissionGranted(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Notifications color="primary" />
          通知とサウンドの設定
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Claude Crewでは、セッションの状態変化（アイドル、ビジー、入力待ち）を通知でお知らせできます。
        </Typography>
        
        <Box sx={{ my: 2 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <Notifications fontSize="small" />
            <Typography variant="body2">
              <strong>ブラウザ通知:</strong> ワークツリー名と状態変化を表示
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <VolumeUp fontSize="small" />
            <Typography variant="body2">
              <strong>サウンド:</strong> 状態に応じた音声を再生
            </Typography>
          </Box>
        </Box>

        {permissionGranted === false && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            通知権限が拒否されました。ブラウザの設定から後で有効にできます。
          </Alert>
        )}

        {permissionGranted === true && (
          <Alert severity="success" sx={{ mt: 2 }}>
            通知が有効になりました！テスト通知を送信しています。
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSkip} color="inherit">
          後で設定する
        </Button>
        <Button 
          onClick={handleEnableNotifications} 
          variant="contained" 
          color="primary"
          disabled={permissionGranted === true}
        >
          通知を有効にする
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationPermissionDialog;