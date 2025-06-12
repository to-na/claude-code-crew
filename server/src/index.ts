import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

import { setupWebSocket } from './websocket/index.js';
import { setupApiRoutes } from './api/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Middleware
app.use(express.json());

// API Routes (pass io for emitting events)
setupApiRoutes(app, io);

// WebSocket handling
setupWebSocket(io);

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