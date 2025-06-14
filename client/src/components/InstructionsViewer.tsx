import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  Description,
  Error,
} from '@mui/icons-material';
import axios from 'axios';

interface InstructionsData {
  success: boolean;
  content?: string;
  filename?: string;
  path?: string;
  error?: string;
}

interface InstructionsViewerProps {
  worktreePath: string;
  worktreeName: string;
}

const InstructionsViewer: React.FC<InstructionsViewerProps> = ({
  worktreePath,
  worktreeName,
}) => {
  const [instructions, setInstructions] = useState<InstructionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInstructions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const encodedPath = encodeURIComponent(worktreePath);
        const response = await axios.get(`/api/worktrees/${encodedPath}/instructions`);
        setInstructions(response.data);
      } catch (err) {
        console.error('[InstructionsViewer] Failed to fetch instructions:', err);
        setError('Failed to load instructions file');
      } finally {
        setLoading(false);
      }
    };

    if (worktreePath) {
      fetchInstructions();
    }
  }, [worktreePath]);

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering for basic formatting
    // Split by lines and process each line
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    
    lines.forEach((line, index) => {
      const key = `line-${index}`;
      
      // Headers
      if (line.startsWith('# ')) {
        elements.push(
          <Typography key={key} variant="h4" component="h1" gutterBottom sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
            {line.substring(2)}
          </Typography>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <Typography key={key} variant="h5" component="h2" gutterBottom sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
            {line.substring(3)}
          </Typography>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <Typography key={key} variant="h6" component="h3" gutterBottom sx={{ mt: 1.5, mb: 0.5, fontWeight: 'bold' }}>
            {line.substring(4)}
          </Typography>
        );
      } else if (line.startsWith('#### ')) {
        elements.push(
          <Typography key={key} variant="subtitle1" component="h4" gutterBottom sx={{ mt: 1, mb: 0.5, fontWeight: 'bold' }}>
            {line.substring(5)}
          </Typography>
        );
      }
      // Code blocks (simple detection)
      else if (line.startsWith('```')) {
        // Skip for now, could be enhanced later
        elements.push(
          <Typography key={key} variant="body2" sx={{ fontFamily: 'monospace', backgroundColor: 'grey.100', p: 0.5, my: 0.5 }}>
            {line}
          </Typography>
        );
      }
      // Lists
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <Typography key={key} variant="body1" component="li" sx={{ ml: 2, mb: 0.5 }}>
            {line.substring(2)}
          </Typography>
        );
      } else if (line.match(/^\d+\. /)) {
        const match = line.match(/^(\d+)\. (.*)$/);
        if (match) {
          elements.push(
            <Typography key={key} variant="body1" component="li" sx={{ ml: 2, mb: 0.5 }}>
              {match[2]}
            </Typography>
          );
        }
      }
      // Horizontal rule
      else if (line.trim() === '---' || line.trim() === '***') {
        elements.push(<Divider key={key} sx={{ my: 2 }} />);
      }
      // Empty line
      else if (line.trim() === '') {
        elements.push(<Box key={key} sx={{ height: 8 }} />);
      }
      // Regular paragraph
      else {
        // Process inline formatting
        let processedLine = line;
        
        // Bold **text**
        processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic *text*
        processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Inline code `code`
        processedLine = processedLine.replace(/`(.*?)`/g, '<code style=\"background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace;\">$1</code>');
        
        elements.push(
          <Typography 
            key={key} 
            variant="body1" 
            sx={{ mb: 1, lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: processedLine }}
          />
        );
      }
    });
    
    return elements;
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading instructions...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" icon={<Error />}>
          <Typography variant="body1">{error}</Typography>
        </Alert>
      </Box>
    );
  }

  if (!instructions) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <Typography variant="body1">No instructions loaded</Typography>
        </Alert>
      </Box>
    );
  }

  if (!instructions.success) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" icon={<Description />}>
          <Typography variant="body1">
            Instructions file not found: {instructions.filename}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Expected file: {worktreeName.replace(/\//g, '_')}_instructions.md
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        backgroundColor: 'background.paper',
      }}
    >
      <Paper elevation={0} sx={{ p: 3, height: '100%' }}>
        <Box sx={{ mb: 2 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <Description color="primary" />
            <Typography variant="h6" component="h1">
              Instructions
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {instructions.filename}
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ maxWidth: '100%', wordBreak: 'break-word' }}>
          {instructions.content ? renderMarkdown(instructions.content) : (
            <Typography variant="body1" color="text.secondary">
              No content available
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default InstructionsViewer;