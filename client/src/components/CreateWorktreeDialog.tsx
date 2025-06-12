import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
} from '@mui/material';
import axios from 'axios';

interface CreateWorktreeDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateWorktreeDialog: React.FC<CreateWorktreeDialogProps> = ({
  open,
  onClose,
}) => {
  const [path, setPath] = useState('');
  const [branch, setBranch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!path || !branch) {
      setError('Both path and branch are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/worktrees', { path, branch });
      setPath('');
      setBranch('');
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
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Worktree</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Worktree Path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            fullWidth
            placeholder="../my-feature"
            helperText="Relative or absolute path for the new worktree"
            disabled={loading}
          />
          <TextField
            label="Branch Name"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            fullWidth
            placeholder="feature/new-feature"
            helperText="New or existing branch name"
            disabled={loading}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={loading || !path || !branch}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateWorktreeDialog;