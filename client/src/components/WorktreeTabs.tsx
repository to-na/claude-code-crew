import React from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
} from '@mui/material';
import {
  Terminal,
  Description,
  Code,
} from '@mui/icons-material';

export type TabType = 'claude' | 'terminal' | 'instructions';

interface WorktreeTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  hasInstructions: boolean;
}

const WorktreeTabs: React.FC<WorktreeTabsProps> = ({
  activeTab,
  onTabChange,
  hasInstructions,
}) => {
  const handleTabChange = (_event: React.SyntheticEvent, newValue: TabType) => {
    onTabChange(newValue);
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        backgroundColor: 'background.paper'
      }}
    >
      <Box sx={{ px: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="worktree tabs"
          sx={{
            minHeight: 48,
            '& .MuiTab-root': {
              minWidth: 120,
              textTransform: 'none',
            },
          }}
        >
          <Tab
            icon={<Code />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Claude Code
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Ctrl+1
                </Typography>
              </Box>
            }
            value="claude"
            sx={{
              fontWeight: activeTab === 'claude' ? 600 : 400,
            }}
          />
          <Tab
            icon={<Terminal />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Terminal
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Ctrl+2
                </Typography>
              </Box>
            }
            value="terminal"
            sx={{
              fontWeight: activeTab === 'terminal' ? 600 : 400,
            }}
          />
          {hasInstructions && (
            <Tab
              icon={<Description />}
              iconPosition="start"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Instructions
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Ctrl+3
                  </Typography>
                </Box>
              }
              value="instructions"
              sx={{
                fontWeight: activeTab === 'instructions' ? 600 : 400,
              }}
            />
          )}
        </Tabs>
      </Box>
    </Paper>
  );
};

export default WorktreeTabs;