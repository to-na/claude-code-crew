import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  Box,
  Typography,
} from '@mui/material';
import axios from 'axios';
import { Worktree } from '../../../shared/types';

interface MergeWorktreeDialogProps {
  open: boolean;
  onClose: () => void;
  worktrees: Worktree[];
}

const MergeWorktreeDialog: React.FC<MergeWorktreeDialogProps> = ({
  open,
  onClose,
  worktrees,
}) => {
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [deleteAfterMerge, setDeleteAfterMerge] = useState(false);
  const [useRebase, setUseRebase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const branches = worktrees.map(w => w.branch.replace('refs/heads/', ''));

  const handleMerge = async () => {
    if (!sourceBranch || !targetBranch) {
      setError('Both source and target branches are required');
      return;
    }

    if (sourceBranch === targetBranch) {
      setError('Source and target branches must be different');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/worktrees/merge', {
        sourceBranch,
        targetBranch,
        deleteAfterMerge,
        useRebase,
      });
      
      setSourceBranch('');
      setTargetBranch('');
      setDeleteAfterMerge(false);
      setUseRebase(false);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to merge worktrees');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSourceBranch('');
      setTargetBranch('');
      setDeleteAfterMerge(false);
      setUseRebase(false);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Merge Worktree</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          
          <Typography variant="body2" color="textSecondary">
            {useRebase 
              ? 'Rebase source branch onto target branch'
              : 'Merge source branch into target branch'}
          </Typography>

          <FormControl fullWidth disabled={loading}>
            <InputLabel>Source Branch</InputLabel>
            <Select
              value={sourceBranch}
              onChange={(e) => setSourceBranch(e.target.value)}
              label="Source Branch"
            >
              {branches.map((branch) => (
                <MenuItem key={branch} value={branch}>
                  {branch}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={loading}>
            <InputLabel>Target Branch</InputLabel>
            <Select
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              label="Target Branch"
            >
              {branches.map((branch) => (
                <MenuItem key={branch} value={branch}>
                  {branch}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={useRebase}
                onChange={(e) => setUseRebase(e.target.checked)}
                disabled={loading}
              />
            }
            label="Use rebase instead of merge"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={deleteAfterMerge}
                onChange={(e) => setDeleteAfterMerge(e.target.checked)}
                disabled={loading}
              />
            }
            label="Delete source worktree after merge"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleMerge}
          variant="contained"
          disabled={loading || !sourceBranch || !targetBranch}
        >
          {useRebase ? 'Rebase' : 'Merge'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MergeWorktreeDialog;