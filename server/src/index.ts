import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import cors from 'cors';

import { setupWebSocket } from './websocket/index.js';
import { setupApiRoutes } from './api/index.js';
import { SessionManager } from './services/sessionManager.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',  // Vite dev server
    'http://localhost:3002',  // NPM published version
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
  ],
  credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Create shared SessionManager instance
const sessionManager = new SessionManager();

// API Routes (pass io and sessionManager)
setupApiRoutes(app, io, sessionManager);

// WebSocket handling (pass sessionManager)
setupWebSocket(io, sessionManager);

// Serve static files in production
const publicPath = join(dirname(dirname(__dirname)), 'public');
console.log('Production mode:', IS_PRODUCTION);
console.log('Public path:', publicPath);

if (IS_PRODUCTION) {
  app.use(express.static(publicPath));
  app.get('*', (req, res) => {
    res.sendFile(join(publicPath, 'index.html'));
  });
} else {
  // Development mode - serve built files if available  
  if (require('fs').existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
        return;
      }
      res.sendFile(join(publicPath, 'index.html'));
    });
  }
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.WORK_DIR) {
    console.log(`Working directory: ${process.env.WORK_DIR}`);
  }
});