import {
  registerUser,
  loginUser,
  sendOTP,
  verifyOTP,
  refreshToken,
  logoutUser,
  getUserById,
} from './service.js';
import { registerSchema, loginSchema, sendOTPSchema, verifyOTPSchema } from '../../lib/validation.js';

/**
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    // Validate request
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const result = await registerUser(value);
    res.status(201).json({
      data: result,
      message: 'User registered successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    // Validate request
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const result = await loginUser(value.phoneNumber, value.password);
    res.status(200).json({
      data: result,
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/send-otp
 */
export const sendOTPHandler = async (req, res, next) => {
  try {
    // Validate request
    const { error, value } = sendOTPSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const result = await sendOTP(value.phoneNumber, value.purpose);
    res.status(200).json({
      data: result,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/verify-otp
 */
export const verifyOTPHandler = async (req, res, next) => {
  try {
    // Validate request
    const { error, value } = verifyOTPSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const result = await verifyOTP(value.phoneNumber, value.code);
    res.status(200).json({
      data: result,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    const result = await logoutUser(req.userId);
    res.status(200).json({
      data: result,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 */
export const refreshTokenHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authorization header',
        },
      });
    }

    const token = authHeader.substring(7);
    const result = await refreshToken(token);

    res.status(200).json({
      data: result,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await getUserById(req.userId);
    res.status(200).json({
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
