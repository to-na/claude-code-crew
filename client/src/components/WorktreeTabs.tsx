import React from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Terminal,
  Description,
} from '@mui/icons-material';

export type TabType = 'terminal' | 'instructions';

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
            icon={<Terminal />}
            iconPosition="start"
            label="Terminal"
            value="terminal"
            sx={{
              fontWeight: activeTab === 'terminal' ? 600 : 400,
            }}
          />
          {hasInstructions && (
            <Tab
              icon={<Description />}
              iconPosition="start"
              label="Instructions"
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