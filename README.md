# Claude Code Crew

[![npm version](https://badge.fury.io/js/claude-code-crew.svg)](https://www.npmjs.com/package/claude-code-crew)
[![npm downloads](https://img.shields.io/npm/dm/claude-code-crew.svg)](https://www.npmjs.com/package/claude-code-crew)
[![CI](https://github.com/to-na/claude-code-crew/actions/workflows/ci.yml/badge.svg)](https://github.com/to-na/claude-code-crew/actions/workflows/ci.yml)
[![Test Coverage](https://github.com/to-na/claude-code-crew/actions/workflows/coverage.yml/badge.svg)](https://github.com/to-na/claude-code-crew/actions/workflows/coverage.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claude-code-crew.svg)](https://nodejs.org)
[![GitHub Issues](https://img.shields.io/github/issues/to-na/claude-code-crew.svg)](https://github.com/to-na/claude-code-crew/issues)
[![GitHub Stars](https://img.shields.io/github/stars/to-na/claude-code-crew.svg)](https://github.com/to-na/claude-code-crew/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/to-na/claude-code-crew/pulls)

A web-based interface for managing multiple Claude Code sessions across Git worktrees.

## Features

- 🖥️ **Browser-based Terminal**: Full terminal emulation using xterm.js
- 🔄 **Real-time Session Management**: Monitor session states (busy/waiting/idle)
- 🌳 **Git Worktree Operations**: Create, delete, and merge worktrees
- 🔌 **WebSocket Communication**: Real-time updates and terminal streaming
- 🎨 **Modern UI**: Built with React and Material-UI
- 📱 **Single-port Architecture**: Everything runs on one port for easy deployment

## Prerequisites

- [Claude Code CLI](https://claude.ai/code) must be installed and available in your PATH
- Node.js 18+ 
- Git repository (the tool manages Git worktrees)

## Installation

[![npm install claude-code-crew](https://nodei.co/npm/claude-code-crew.png?mini=true)](https://npmjs.org/package/claude-code-crew)

```bash
npm install -g claude-code-crew
```

## Usage

Navigate to any Git repository and run:

```bash
cd /path/to/your/git/repo
claude-code-crew
```

The web interface will be available at **http://localhost:3001**

### Available Features:
- **View Worktrees**: See all git worktrees in the sidebar
- **Create Sessions**: Click on any worktree to start a Claude Code session
- **Monitor Status**: Real-time session state indicators (busy/waiting/idle)
- **Terminal History**: Switch between sessions and see previous output
- **Manage Worktrees**: Create, delete, or merge worktrees from the UI

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3001)
- `WORK_DIR`: Working directory (default: current directory)
- `CC_CLAUDE_ARGS`: Additional arguments for Claude Code sessions

### Example with custom port:
```bash
PORT=8080 claude-code-crew
```

## Architecture

### Backend (Node.js + Express + Socket.io)
- REST API for worktree operations
- WebSocket server for terminal sessions
- PTY management using node-pty
- Session state detection and history preservation

### Frontend (React + TypeScript + Material-UI)
- Terminal emulation with xterm.js
- Real-time session status updates
- Worktree management UI
- Responsive sidebar navigation

### Single-port Design
- Serves both API and web UI on the same port
- No CORS configuration needed
- Easy to deploy and use

## Development

For contributors who want to develop claude-code-crew:

### Setup
```bash
git clone https://github.com/to-na/claude-code-crew.git
cd claude-code-crew
pnpm install
```

### Development Mode
```bash
# Start development environment
./start.sh
```

### Build
```bash
pnpm run build
```

## Tech Stack

- **Backend**: Node.js, Express, Socket.io, node-pty
- **Frontend**: React, TypeScript, Material-UI, xterm.js
- **Build Tools**: Vite, TypeScript
- **Communication**: WebSocket, REST API

## Troubleshooting

### Common Issues

**"claude: command not found"**
- Install Claude Code CLI first: https://claude.ai/code

**"No worktrees found"**
- Make sure you're running the command inside a Git repository
- Check that the repository has at least one worktree

**Port already in use**
- Change the port: `PORT=8080 claude-code-crew`
- Or stop the process using port 3001

**Terminal not showing history**
- Try clicking on the worktree again to reactivate the session
- Check browser console for WebSocket connection errors

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.