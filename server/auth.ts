import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail, getUserById, isMongoActive } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'alignhub-fallback-jwt-secret-998877';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

// Token Generator
export function generateToken(user: { _id: string; name: string; email: string; avatarUrl?: string }) {
  return jwt.sign(
    {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Authentication Middleware for API Routes
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!isMongoActive()) {
      res.status(503).json({
        error: 'Database connection is offline',
        message: 'The server could not connect to MongoDB Atlas. Please ensure that you have configured your database in .env and that your MongoDB Atlas network settings allow connections from anywhere (0.0.0.0/0).'
      });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
       res.status(401).json({ error: 'Authorization header missing or invalid format. Use Bearer <token>' });
       return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const user = await getUserById(decoded.id);
    if (!user) {
       res.status(401).json({ error: 'User associated with this token does not exist' });
       return;
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl
    };

    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token', message: err.message });
  }
}

// Socket JWT Verification helper
export function verifySocketToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (err) {
    return null;
  }
}

// Auth API Router Handler
export async function handleRegister(req: Request, res: Response) {
  try {
    if (!isMongoActive()) {
      res.status(503).json({
        error: 'Database connection is offline',
        message: 'The server is currently unable to connect to your MongoDB Atlas database. Please verify your password in .env and make sure "Allow Access from Anywhere" (0.0.0.0/0) is configured in your MongoDB Atlas IP Whitelist.'
      });
      return;
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
       res.status(400).json({ error: 'Name, email, and password are required fields' });
       return;
    }

    // Check if user already exists
    const existing = await getUserByEmail(email);
    if (existing) {
       res.status(400).json({ error: 'An account with this email address already exists' });
       return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    const user = await createUser({
      name,
      email,
      password: hashedPassword
    });

    // Generate Token
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email
      }
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error during registration', details: err.message });
  }
}

export async function handleLogin(req: Request, res: Response) {
  try {
    if (!isMongoActive()) {
      res.status(503).json({
        error: 'Database connection is offline',
        message: 'The server is currently unable to connect to your MongoDB Atlas database. Please verify your password in .env and make sure "Allow Access from Anywhere" (0.0.0.0/0) is configured in your MongoDB Atlas IP Whitelist.'
      });
      return;
    }

    const { email, password } = req.body;

    if (!email || !password) {
       res.status(400).json({ error: 'Email and password are required fields' });
       return;
    }

    // Find User
    const user = await getUserByEmail(email);
    if (!user) {
       res.status(400).json({ error: 'Invalid email or password' });
       return;
    }

    // Compare Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
       res.status(400).json({ error: 'Invalid email or password' });
       return;
    }

    // Generate Token
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login', details: err.message });
  }
}

export async function handleGetMe(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ user: req.user });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error fetching user profile' });
  }
}
