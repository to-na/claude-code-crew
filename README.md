# Claude Code Crew - GUI Claude Code Session Manager

A browser-based interface for managing multiple Claude Code sessions across Git worktrees.

## Features

- 🖥️ **Browser UI-based Terminal**: Full terminal emulation using xterm.js
- 🔄 **Real-time Session Management**: Monitor session states (busy/waiting/idle)
- 🌳 **Git Worktree Operations**: Create, delete, and merge worktrees
- 🔌 **WebSocket Communication**: Real-time updates and terminal streaming
- 🎨 **Modern UI**: Built with React and Material-UI

## Quick Start

### Local Development
```bash
cd claude-code-crew
./start.sh
```

### Global Installation
```bash
# Install globally
npm install -g claude-code-crew

# Run in any git repository
cd /path/to/your/git/repo
claude-code-crew
```

## Installation

### For Development
```bash
cd claude-code-crew
pnpm install  # or npm install
```

### For Global Use
```bash
npm install -g claude-code-crew
# or
pnpm add -g claude-code-crew
```

## Development

```bash
# Start both server and client in development mode
pnpm dev  # or npm run dev

# Or run them separately
pnpm dev:server  # Backend on http://localhost:3001
pnpm dev:client  # Frontend on http://localhost:3000
```

## Build

```bash
npm run build
```

## Production

```bash
npm start
```

## Usage

Once installed, navigate to any Git repository and run:

```bash
claude-code-crew
```

The web interface will be available at http://localhost:3001

### Features Available:
- **View Worktrees**: See all git worktrees in the sidebar
- **Create Session**: Click on any worktree to start a Claude Code session
- **Monitor Status**: Real-time session state indicators (busy/waiting/idle)
- **Manage Worktrees**: Create, delete, or merge worktrees from the UI

## Architecture

### Backend (Node.js + Express + Socket.io)
- REST API for worktree operations
- WebSocket server for terminal sessions
- PTY management using node-pty
- Session state detection

### Frontend (React + TypeScript + Material-UI)
- Terminal emulation with xterm.js
- Real-time session status updates
- Worktree management UI
- Responsive sidebar navigation

## Environment Variables

- `PORT`: Server port (default: 3001)
- `CLIENT_URL`: Client URL for CORS (default: http://localhost:3000)
- `CC_CLAUDE_ARGS`: Additional arguments for Claude Code sessions

## Tech Stack

- **Backend**: Node.js, Express, Socket.io, node-pty
- **Frontend**: React, TypeScript, Material-UI, xterm.js
- **Build Tools**: Vite, TSX
- **Communication**: WebSocket, REST API