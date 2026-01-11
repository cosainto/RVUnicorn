import dotenv from 'dotenv';
dotenv.config();

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
console.log('🔐 Auth middleware JWT_SECRET:', JWT_SECRET);
interface JwtPayload {
  userId: string;
  email: string;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  console.log('Auth middleware called');
  console.log('Headers:', req.headers);
  
  const authHeader = req.headers['authorization'];
  console.log('Auth header:', authHeader);
  
  const token = authHeader && authHeader.split(' ')[1];
  console.log('Token extracted:', token ? token.substring(0, 20) + '...' : 'No token');

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    console.log('🔓 Verifying token with secret:', JWT_SECRET); // ADD THIS
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    console.log('Token decoded successfully:', decoded);
    
    (req as any).userId = decoded.userId;
    (req as any).user = { id: decoded.userId, email: decoded.email };
    
    console.log('req.userId is now:', (req as any).userId);
    console.log('req.user is now:', (req as any).user);
    
    next();
  } catch (error) {
    console.log('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).userId = decoded.userId;
    (req as any).user = { id: decoded.userId, email: decoded.email };

    next();
  } catch (error) {
    // Invalid token, but it's optional so continue without auth
    next();
  }
};
