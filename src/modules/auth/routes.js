import express from 'express';
import {
  register,
  login,
  sendOTPHandler,
  verifyOTPHandler,
  logout,
  refreshTokenHandler,
  getCurrentUser,
  checkExistence,
} from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register - Register new user
router.post('/register', register);

// POST /api/auth/check-existence - Check if user exists
router.post('/check-existence', checkExistence);

// POST /api/auth/login - Login user
router.post('/login', login);

// POST /api/auth/send-otp - Send OTP
router.post('/send-otp', sendOTPHandler);

// POST /api/auth/verify-otp - Verify OTP
router.post('/verify-otp', verifyOTPHandler);

// POST /api/auth/logout - Logout user
router.post('/logout', authenticate, logout);

// POST /api/auth/refresh - Refresh token
router.post('/refresh', refreshTokenHandler);

// GET /api/auth/me - Get current user
router.get('/me', authenticate, getCurrentUser);

export default router;
