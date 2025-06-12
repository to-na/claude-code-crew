import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Socket } from 'socket.io-client';
import { Session } from '../../../shared/types';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  session: Session;
  socket: Socket;
}

const TerminalView: React.FC<TerminalViewProps> = ({ session, socket }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#0a0a0a',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Open terminal in the DOM
    term.open(terminalRef.current);
    fitAddon.fit();

    // Store references
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle terminal input
    term.onData((data) => {
      socket.emit('session:input', { sessionId: session.id, input: data });
    });

    // Handle terminal resize
    term.onResize(({ cols, rows }) => {
      socket.emit('session:resize', { sessionId: session.id, cols, rows });
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    // Socket event handlers
    const handleOutput = ({ sessionId, data }: { sessionId: string; data: string }) => {
      if (sessionId === session.id) {
        term.write(data);
      }
    };

    const handleRestore = ({ sessionId, history }: { sessionId: string; history: string }) => {
      if (sessionId === session.id) {
        term.clear();
        term.write(history);
      }
    };

    socket.on('session:output', handleOutput);
    socket.on('session:restore', handleRestore);

    // Request session restore if reconnecting
    socket.emit('session:restore', session.id);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('session:output', handleOutput);
      socket.off('session:restore', handleRestore);
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [session.id, socket]);

  // Handle session changes
  useEffect(() => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [session]);

  return (
    <Box
      ref={terminalRef}
      sx={{
        flexGrow: 1,
        padding: 1,
        backgroundColor: '#0a0a0a',
        '& .xterm': {
          padding: '10px',
        },
        '& .xterm-viewport': {
          backgroundColor: 'transparent !important',
        },
      }}
    />
  );
};

export default TerminalView;