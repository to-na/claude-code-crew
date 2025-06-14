import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore,
  PlayArrow,
  Settings,
} from '@mui/icons-material';
import { AutoEnterService, AutoEnterSettings as IAutoEnterSettings } from '../services/autoEnterService';
import { Worktree } from '../../../shared/types';

interface AutoEnterSettingsProps {
  worktrees: Worktree[];
}

const AutoEnterSettings: React.FC<AutoEnterSettingsProps> = ({ worktrees }) => {
  const autoEnterService = AutoEnterService.getInstance();
  const [settings, setSettings] = useState<IAutoEnterSettings>(autoEnterService.getSettings());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // コンポーネントマウント時に最新の設定を取得
    setSettings(autoEnterService.getSettings());
  }, []);

  const handleGlobalToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    autoEnterService.setGlobalEnabled(enabled);
    setSettings(autoEnterService.getSettings());
  };


  const handleWorktreeToggle = (worktreePath: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    autoEnterService.setWorktreeSetting(worktreePath, enabled);
    setSettings(autoEnterService.getSettings());
  };


  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        自動Enter設定
      </Typography>
      
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.globalEnabled}
              onChange={handleGlobalToggle}
              color="primary"
            />
          }
          label={
            <Box display="flex" alignItems="center" gap={1}>
              <PlayArrow />
              <Typography>自動Enter機能を有効にする</Typography>
            </Box>
          }
        />
      </FormGroup>


      <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
        wait_input状態になった際に、3秒後に自動でEnterキーを送信します。
      </Alert>

      {settings.globalEnabled && worktrees.length > 0 && (
        <Accordion 
          expanded={expanded} 
          onChange={(_event, isExpanded) => setExpanded(isExpanded)}
          sx={{ mt: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center" gap={1}>
              <Settings />
              <Typography>ワークツリー別設定</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              各ワークツリーごとに自動Enter機能のON/OFFを設定できます
            </Typography>
            
            <List dense>
              {worktrees.map((worktree, index) => (
                <React.Fragment key={worktree.path}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={worktree.branch}
                      secondary={worktree.path}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        edge="end"
                        checked={settings.perWorktreeSettings[worktree.path] ?? true}
                        onChange={handleWorktreeToggle(worktree.path)}
                        disabled={!settings.globalEnabled}
                        color="primary"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {!settings.globalEnabled && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          グローバル設定が無効になっています。自動Enter機能を使用するには、まずグローバル設定を有効にしてください。
        </Alert>
      )}
    </Box>
  );
};

export default AutoEnterSettings;