import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { handleRegister, handleLogin, handleGetMe, authMiddleware } from './server/auth';
import { connectDB } from './server/db';
import apiRouter from './server/routes';
import { setupSockets } from './server/sockets';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Validate critical environment variables
  const MONGODB_URI = process.env.MONGODB_URI;
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!MONGODB_URI || MONGODB_URI.startsWith('mongodb+srv://...')) {
    console.error('\n====================================================================');
    console.error('✗ MongoDB Connection Failed: MONGODB_URI environment variable is missing!');
    console.error('Please configure a valid MongoDB Atlas connection string in your .env file:');
    console.error('MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/alignhub?retryWrites=true&w=majority"');
    console.error('====================================================================\n');
  }

  if (!JWT_SECRET || JWT_SECRET === 'alignhub-fallback-jwt-secret-998877') {
    console.warn('\n====================================================================');
    console.warn('⚠️ WARNING: JWT_SECRET environment variable is missing or using insecure fallback.');
    console.warn('Please define a secure JWT_SECRET in your .env file:');
    console.warn('JWT_SECRET="your_custom_secure_jwt_key_here"');
    console.warn('====================================================================\n');
  }

  // Connect to MongoDB Atlas first
  try {
    await connectDB();
  } catch (err: any) {
    console.error('\n====================================================================');
    console.error('✗ MongoDB Connection Failed!');
    console.error('Error Details:', err.message);
    console.error('Please verify:');
    console.error('1. Your connection string (username, password, database name) in .env is correct.');
    console.error('2. IMPORTANT: Your MongoDB Atlas cluster allows connection from your dynamic host IP.');
    console.error('   Go to Atlas -> Network Access -> IP Access List, and click "Add IP Address".');
    console.error('   Add "0.0.0.0/0" (Allow Access from Anywhere) for temporary testing.');
    console.error('====================================================================\n');
    console.warn('⚠️ Server is running but database-dependent features will fail gracefully with clear status codes until MongoDB is connected.');
  }

  // JSON request body parser
  app.use(express.json());

  // Serve file uploads statically so that team members can download/view files
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // ==========================================
  // Auth API Endpoints
  // ==========================================
  app.post('/api/auth/register', handleRegister);
  app.post('/api/auth/login', handleLogin);
  app.get('/api/auth/me', authMiddleware, handleGetMe);

  // ==========================================
  // Main Workspace API Endpoints
  // ==========================================
  app.use('/api', apiRouter);

  // ==========================================
  // Socket.IO Real-Time Server Configuration
  // ==========================================
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  setupSockets(io);

  // ==========================================
  // Vite Dev Middleware / Static Build Routing
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Wildcard fallback router to serve SPA client index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind to port 3000, 0.0.0.0 as required by host ingress container proxy
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[AlignHub] Full-Stack Server successfully booted on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[AlignHub] Fatal error during full-stack startup:', err);
});
