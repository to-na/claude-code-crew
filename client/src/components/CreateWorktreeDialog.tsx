import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Autocomplete,
  Typography,
  CircularProgress,
} from '@mui/material';
import axios from 'axios';
import { CreateWorktreeRequest } from '../../../shared/types';

interface CreateWorktreeDialogProps {
  open: boolean;
  onClose: () => void;
}

interface BranchesResponse {
  local: string[];
  remote: string[];
}

const CreateWorktreeDialog: React.FC<CreateWorktreeDialogProps> = ({
  open,
  onClose,
}) => {
  const [path, setPath] = useState('');
  const [branch, setBranch] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [branchType, setBranchType] = useState<'new' | 'existing'>('new');
  const [branches, setBranches] = useState<BranchesResponse>({ local: [], remote: [] });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Fetch branches when dialog opens
  useEffect(() => {
    if (open) {
      fetchBranches();
    }
  }, [open]);

  const fetchBranches = async () => {
    setBranchesLoading(true);
    try {
      const response = await axios.get<BranchesResponse>('/api/branches');
      setBranches(response.data);
      
      // Set default base branch to 'main' or first available branch
      const availableBranches = [...response.data.local, ...response.data.remote];
      const defaultBase = availableBranches.find(b => b === 'main' || b === 'origin/main') || availableBranches[0];
      if (defaultBase) {
        setBaseBranch(defaultBase);
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      setError('Failed to load branches');
    } finally {
      setBranchesLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!path || !branch) {
      setError('Both path and branch are required');
      return;
    }

    if (branchType === 'new' && !baseBranch) {
      setError('Base branch is required for new branches');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requestData: CreateWorktreeRequest = {
        path,
        branch,
        baseBranch: branchType === 'new' ? baseBranch : undefined,
        isNewBranch: branchType === 'new',
      };

      await axios.post('/api/worktrees', requestData);
      
      // Reset form
      setPath('');
      setBranch('');
      setBaseBranch('');
      setBranchType('new');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create worktree');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPath('');
      setBranch('');
      setBaseBranch('');
      setBranchType('new');
      setError(null);
      onClose();
    }
  };

  const allBranches = [...branches.local, ...branches.remote];
  const availableExistingBranches = branches.local.filter(branch => 
    // Filter out branches that are already used by worktrees
    // This could be enhanced by checking existing worktrees
    branch !== ''
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Worktree</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            label="Worktree Path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="e.g., ../feature-branch"
            disabled={loading}
            fullWidth
            helperText="Relative path from current repository"
          />

          <FormControl component="fieldset">
            <FormLabel component="legend">Branch Type</FormLabel>
            <RadioGroup
              value={branchType}
              onChange={(e) => setBranchType(e.target.value as 'new' | 'existing')}
              row
            >
              <FormControlLabel value="new" control={<Radio />} label="Create New Branch" />
              <FormControlLabel value="existing" control={<Radio />} label="Use Existing Branch" />
            </RadioGroup>
          </FormControl>

          {branchType === 'new' ? (
            <>
              <TextField
                label="New Branch Name"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="e.g., feature/user-auth"
                disabled={loading}
                fullWidth
              />
              
              {branchesLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Loading branches...</Typography>
                </Box>
              ) : (
                <Autocomplete
                  options={allBranches}
                  value={baseBranch}
                  onChange={(_event, newValue) => setBaseBranch(newValue || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Base Branch"
                      placeholder="Select base branch"
                      disabled={loading}
                      helperText="Branch to create new branch from"
                    />
                  )}
                  disabled={loading}
                />
              )}
            </>
          ) : (
            <Autocomplete
              options={availableExistingBranches}
              value={branch}
              onChange={(_event, newValue) => setBranch(newValue || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Existing Branch"
                  placeholder="Select existing branch"
                  disabled={loading || branchesLoading}
                />
              )}
              disabled={loading || branchesLoading}
              loading={branchesLoading}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleCreate} 
          variant="contained" 
          disabled={loading || branchesLoading}
        >
          {loading ? 'Creating...' : 'Create Worktree'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateWorktreeDialog;