import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from './error-handler.js';
import { getPrismaClient } from '../lib/prisma.js';
import { getAdminScope } from './scope-validator.js';

const prisma = getPrismaClient();

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

export const authorize = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return next(new UnauthorizedError('User not authenticated'));
      }

      // If no roles are required, allow access
      if (allowedRoles.length === 0) {
        return next();
      }

      // Fetch user's roles
      const member = await prisma.member.findFirst({
        where: { authUserId: req.userId },
        include: {
          roleAssignments: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!member) {
        // User is authenticated but has no member profile?
        return next(new ForbiddenError('User profile not found'));
      }

      const userRoles = member.roleAssignments.map((assignment) => assignment.role.name);

      // Check if user has any of the allowed roles
      const hasPermission = userRoles.some((role) => allowedRoles.includes(role));

      if (!hasPermission) {
        return next(new ForbiddenError('Insufficient permissions'));
      }

      // Attach roles and scope to request for subsequent use
      req.userRoles = userRoles;
      req.adminScope = await getAdminScope(req.userId);

      next();
    } catch (error) {
      next(error);
    }
  };
};
