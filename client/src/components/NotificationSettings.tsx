import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Switch,
  Button,
  IconButton,
  Tooltip,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import {
  Notifications,
  VolumeUp,
  Settings,
} from '@mui/icons-material';
import { NotificationService, NotificationSettings as INotificationSettings } from '../services/notificationService';
import AutoEnterSettings from './AutoEnterSettings';
import { Worktree } from '../../../shared/types';

interface NotificationSettingsProps {
  variant?: 'dialog' | 'inline';
  onClose?: () => void;
  worktrees?: Worktree[];
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ variant = 'dialog', onClose, worktrees = [] }) => {
  const notificationService = NotificationService.getInstance();
  const [settings, setSettings] = useState<INotificationSettings>(notificationService.getSettings());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (settings.notificationsEnabled) {
      // ユーザーが設定を有効にした時に権限を要求
      notificationService.requestNotificationPermissionWithUserAction();
    }
  }, [settings.notificationsEnabled]);

  const handleSettingChange = (key: keyof INotificationSettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSettings = {
      ...settings,
      [key]: event.target.checked,
    };
    setSettings(newSettings);
    notificationService.saveSettings(newSettings);
  };

  const handleClose = () => {
    setOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const settingsContent = (
    <>
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.notificationsEnabled}
              onChange={handleSettingChange('notificationsEnabled')}
              color="primary"
            />
          }
          label={
            <Box display="flex" alignItems="center" gap={1}>
              <Notifications />
              <Typography>通知を有効にする</Typography>
            </Box>
          }
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.soundEnabled}
              onChange={handleSettingChange('soundEnabled')}
              color="primary"
            />
          }
          label={
            <Box display="flex" alignItems="center" gap={1}>
              <VolumeUp />
              <Typography>音声を有効にする</Typography>
            </Box>
          }
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
          通知機能でセッションの状態変化（アイドル、ビジー、入力待ち）をお知らせします
        </Typography>
      </FormGroup>
      
      <Divider sx={{ my: 3 }} />
      
      <AutoEnterSettings worktrees={worktrees} />
    </>
  );

  if (variant === 'inline') {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Notification Settings
        </Typography>
        {settingsContent}
      </Box>
    );
  }

  return (
    <>
      <Tooltip title="Notification Settings">
        <IconButton onClick={() => setOpen(true)} color="inherit">
          <Settings />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Settings />
            Notification Settings
          </Box>
        </DialogTitle>
        <DialogContent>
          {settingsContent}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NotificationSettings;