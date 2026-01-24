import {
  registerUser,
  loginUser,
  sendOTP,
  verifyOTP,
  refreshToken,
  logoutUser,
  getUserById,
  checkUserExistence,
  requestPasswordReset,
  resetPassword as resetPasswordService,
  changePassword
} from './service.js';
import {
  registerSchema,
  loginSchema,
  sendOTPSchema,
  verifyOTPSchema,
  checkExistenceSchema,
  resetPasswordSchema,
  changePasswordSchema
} from '../../lib/validation.js';

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
 * POST /api/auth/check-existence
 */
export const checkExistence = async (req, res, next) => {
  try {
    // Validate request
    const { error, value } = checkExistenceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const result = await checkUserExistence(value);
    res.status(200).json({
      data: result,
      message: 'Check completed',
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

    const result = await loginUser(value.identifier, value.password);
    res.status(200).json({
      data: result,
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

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

    const result = await sendOTP(value);
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

    const result = await verifyOTP(value);
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

/**
 * POST /api/auth/forgot-password
 */
export const forgotPasswordHandler = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Identifier is required' }
      });
    }

    const result = await requestPasswordReset(identifier);
    res.status(200).json({
      data: result,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password
 */
export const resetPasswordHandler = async (req, res, next) => {
  try {
    // Frontend sends { identifier, otp, password } which maps to our service args
    const { identifier, otp, password } = req.body;

    if (!identifier || !otp || !password) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' }
      });
    }

    const result = await resetPasswordService(identifier, otp, password);
    res.status(200).json({
      data: result,
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/change-password
 */
export const changePasswordHandler = async (req, res, next) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const { currentPassword, newPassword } = value;
    const result = await changePassword(req.userId, currentPassword, newPassword);

    res.status(200).json({
      data: result,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};
