import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Alert,
  Typography,
} from '@mui/material';
import axios from 'axios';
import { Worktree } from '../../../shared/types';

interface DeleteWorktreeDialogProps {
  open: boolean;
  onClose: () => void;
  worktrees: Worktree[];
}

const DeleteWorktreeDialog: React.FC<DeleteWorktreeDialogProps> = ({
  open,
  onClose,
  worktrees,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const deletableWorktrees = worktrees.filter(w => !w.isMain);

  const handleToggle = (path: string) => {
    const currentIndex = selected.indexOf(path);
    const newSelected = [...selected];

    if (currentIndex === -1) {
      newSelected.push(path);
    } else {
      newSelected.splice(currentIndex, 1);
    }

    setSelected(newSelected);
  };

  const handleDelete = async () => {
    if (selected.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      await axios.delete('/api/worktrees', { data: { paths: selected } });
      setSelected([]);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete worktrees');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelected([]);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Delete Worktrees</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {deletableWorktrees.length === 0 ? (
          <Typography>No worktrees available to delete.</Typography>
        ) : (
          <>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Select worktrees to delete. This will also delete their branches.
            </Typography>
            <List>
              {deletableWorktrees.map((worktree) => (
                <ListItem
                  key={worktree.path}
                  button
                  onClick={() => handleToggle(worktree.path)}
                  disabled={loading}
                >
                  <Checkbox
                    checked={selected.includes(worktree.path)}
                    tabIndex={-1}
                    disableRipple
                  />
                  <ListItemText
                    primary={worktree.branch}
                    secondary={worktree.path}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={loading || selected.length === 0}
        >
          Delete ({selected.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteWorktreeDialog;