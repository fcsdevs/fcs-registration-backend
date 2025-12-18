import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './error-handler.js';

export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing or invalid authorization header'));
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.userId;
    req.user = {
      id: decoded.userId,
      phoneNumber: decoded.phoneNumber,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return next(error);
    }
    return next(new UnauthorizedError('Invalid token'));
  }
};

export const optional = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      req.user = {
        id: decoded.userId,
        phoneNumber: decoded.phoneNumber,
        email: decoded.email,
      };
    }

    next();
  } catch (error) {
    // Optional auth, so we don't throw on invalid token
    next();
  }
};
