import { getPrismaClient } from '../../lib/prisma.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateOTP,
  generateFCSCode,
} from '../../lib/helpers.js';
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

/**
 * Register a new user
 */
export const registerUser = async (data) => {
  const { phoneNumber, email, password, firstName, lastName } = data;

  // Check if user already exists
  const existingUser = await prisma.authUser.findUnique({
    where: { phoneNumber },
  });

  if (existingUser) {
    throw new ValidationError('User with this phone number already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create auth user
  const authUser = await prisma.authUser.create({
    data: {
      phoneNumber,
      email: email || null,
      passwordHash,
    },
  });

  // Create member profile
  const member = await prisma.member.create({
    data: {
      fcsCode: generateFCSCode(),
      authUserId: authUser.id,
      firstName,
      lastName,
      phoneNumber: phoneNumber || null,
      email: email || null,
    },
  });

  // Generate token
  const token = generateToken(authUser.id, phoneNumber, email);

  // Create session
  const session = await prisma.authSession.create({
    data: {
      userId: authUser.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return {
    id: authUser.id,
    phoneNumber: authUser.phoneNumber,
    email: authUser.email,
    member,
    token,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  };
};

/**
 * Login user with phone and password
 */
export const loginUser = async (phoneNumber, password) => {
  // Find user
  const authUser = await prisma.authUser.findUnique({
    where: { phoneNumber },
  });

  if (!authUser) {
    throw new UnauthorizedError('Invalid phone number or password');
  }

  // Check if active
  if (!authUser.isActive) {
    throw new UnauthorizedError('Account is inactive');
  }

  // Verify password
  const isValidPassword = await comparePassword(password, authUser.passwordHash);

  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid phone number or password');
  }

  // Update last login
  await prisma.authUser.update({
    where: { id: authUser.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate token
  const token = generateToken(
    authUser.id,
    authUser.phoneNumber,
    authUser.email
  );

  // Create session
  const session = await prisma.authSession.create({
    data: {
      userId: authUser.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: undefined,
      userAgent: undefined,
    },
  });

  // Get member
  const member = await prisma.member.findFirst({
    where: { authUserId: authUser.id },
  });

  return {
    id: authUser.id,
    phoneNumber: authUser.phoneNumber,
    email: authUser.email,
    member,
    token,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  };
};

/**
 * Send OTP to phone number
 */
export const sendOTP = async (phoneNumber, purpose) => {
  // Check if user exists (for certain purposes)
  if (purpose !== 'REGISTRATION') {
    const authUser = await prisma.authUser.findUnique({
      where: { phoneNumber },
    });

    if (!authUser) {
      throw new NotFoundError('User');
    }
  }

  // Invalidate previous OTPs
  await prisma.oTPToken.deleteMany({
    where: {
      code: { not: null }, // Invalidate by pattern
    },
  });

  // Generate OTP
  const code = generateOTP();

  // Create OTP record
  const otp = await prisma.oTPToken.create({
    data: {
      // Find or create user for phone
      userId:
        (
          await prisma.authUser.findUnique({
            where: { phoneNumber },
          })
        )?.id || null,
      code,
      purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  // TODO: Send OTP via SMS provider (Twilio, etc)
  console.log(`OTP for ${phoneNumber}: ${code}`);

  return {
    message: 'OTP sent',
    expiresIn: '10 minutes',
    // For testing only - remove in production
    otpCode: process.env.NODE_ENV === 'development' ? code : undefined,
  };
};

/**
 * Verify OTP
 */
export const verifyOTP = async (phoneNumber, code) => {
  // Find OTP
  const otp = await prisma.oTPToken.findFirst({
    where: {
      code,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!otp) {
    throw new ValidationError('Invalid or expired OTP');
  }

  // Check attempts
  if (otp.attempts >= 5) {
    throw new ValidationError('Too many attempts. Please request a new OTP.');
  }

  // Mark OTP as used
  await prisma.oTPToken.update({
    where: { id: otp.id },
    data: {
      usedAt: new Date(),
      attempts: otp.attempts + 1,
    },
  });

  // Get or create user
  let authUser = await prisma.authUser.findUnique({
    where: { phoneNumber },
  });

  if (!authUser) {
    authUser = await prisma.authUser.create({
      data: {
        phoneNumber,
        passwordHash: '', // Will be set later
      },
    });
  }

  return {
    verified: true,
    userId: authUser.id,
    message: 'OTP verified successfully',
  };
};

/**
 * Refresh token
 */
export const refreshToken = async (token) => {
  // Verify current token
  const session = await prisma.authSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.revoked || new Date() > session.expiresAt) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  // Revoke old session
  await prisma.authSession.update({
    where: { id: session.id },
    data: { revoked: true, revokedAt: new Date() },
  });

  // Create new token
  const newToken = generateToken(
    session.user.id,
    session.user.phoneNumber,
    session.user.email
  );

  // Create new session
  const newSession = await prisma.authSession.create({
    data: {
      userId: session.user.id,
      token: newToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    token: newToken,
    session: {
      id: newSession.id,
      expiresAt: newSession.expiresAt,
    },
  };
};

/**
 * Logout user
 */
export const logoutUser = async (userId) => {
  // Revoke all sessions for user
  await prisma.authSession.updateMany({
    where: { userId },
    data: { revoked: true, revokedAt: new Date() },
  });

  return {
    message: 'Logged out successfully',
  };
};

/**
 * Get user by ID
 */
export const getUserById = async (userId) => {
  const authUser = await prisma.authUser.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phoneNumber: true,
      email: true,
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!authUser) {
    throw new NotFoundError('User');
  }

  return authUser;
};
