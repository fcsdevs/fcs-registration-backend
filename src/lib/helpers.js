import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Hash a password using bcryptjs
 */
export const hashPassword = async (password) => {
  return bcryptjs.hash(password, SALT_ROUNDS);
};

/**
 * Compare a password with its hash
 */
export const comparePassword = async (password, hash) => {
  return bcryptjs.compare(password, hash);
};

/**
 * Generate JWT token
 */
export const generateToken = (userId, phoneNumber, email) => {
  return jwt.sign(
    { userId, phoneNumber, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

/**
 * Verify JWT token
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Generate OTP code (6-digit)
 */
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate UUID
 */
export const generateUUID = () => {
  return uuidv4();
};

/**
 * Generate FCS Member Code (format: FCS-XXXX-XXXX)
 */
export const generateFCSCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `FCS-${timestamp}-${random}`;
};

/**
 * Get pagination params
 */
export const getPaginationParams = (page = '1', limit = '20') => {
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));

  return {
    skip: (pageNum - 1) * limitNum,
    take: limitNum,
  };
};

/**
 * Format response with pagination
 */
export const formatPaginatedResponse = (data, total, page, limit) => {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

/**
 * Calculate attendance rate (percentage)
 */
export const calculateAttendanceRate = (attended, registered) => {
  if (registered === 0) return 0;
  return Math.round((attended / registered) * 100);
};

/**
 * Check if date is in the past
 */
export const isDateInPast = (date) => {
  return new Date(date).getTime() < Date.now();
};

/**
 * Check if date is in the future
 */
export const isDateInFuture = (date) => {
  return new Date(date).getTime() > Date.now();
};

/**
 * Get date range query for database
 */
export const getDateRangeQuery = (startDate, endDate) => {
  const query = {};

  if (startDate) {
    query.gte = new Date(startDate);
  }

  if (endDate) {
    query.lte = new Date(endDate);
  }

  return Object.keys(query).length > 0 ? query : undefined;
};

/**
 * Normalize phone number to international format (+234)
 */
export const normalizePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return phoneNumber;

  // Convert to string if it's not (e.g. if a number was passed)
  let phoneStr = String(phoneNumber);

  // Remove spaces, dashes, parentheses
  let cleaned = phoneStr.replace(/[\s\-\(\)]/g, '');

  // If starts with '0', replace with '+234'
  if (cleaned.startsWith('0')) {
    cleaned = '+234' + cleaned.substring(1);
  }
  // If starts with '234', add '+'
  else if (cleaned.startsWith('234')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
};
