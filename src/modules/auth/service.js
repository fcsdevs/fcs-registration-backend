import { getPrismaClient } from '../../lib/prisma.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateOTP,
  generateFCSCode,
  normalizePhoneNumber,
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
  const {
    phoneNumber, email, password, firstName, lastName,
    otherNames, preferredName, whatsappNumber, gender, dateOfBirth,
    maritalStatus, occupation, placeOfWork, institutionName,
    institutionType, level, course, graduationYear,
    membershipCategory, yearJoined, state, zone, branch, branchId,
    preferredContactMethod, emergencyContactName, emergencyContactPhone,
    ageBracket, guardianName, guardianPhone, guardianEmail,
    guardianRelationship, privacyPolicyAccepted, termsAccepted
  } = data;
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  // Check if user already exists
  const existingUser = await prisma.authUser.findUnique({
    where: { phoneNumber: normalizedPhone },
  });

  if (existingUser) {
    throw new ValidationError('User with this phone number already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Determine if minor
  let isMinor = false;
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const age = new Date().getFullYear() - dob.getFullYear();
    if (age < 18) isMinor = true;
  }

  // Create auth user
  const authUser = await prisma.authUser.create({
    data: {
      phoneNumber: normalizedPhone,
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
      otherNames: otherNames || null,
      preferredName: preferredName || null,
      phoneNumber: normalizedPhone || null,
      email: email || null,
      whatsappNumber: whatsappNumber ? normalizePhoneNumber(whatsappNumber) : null,
      gender: gender ? gender.toUpperCase() : null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      maritalStatus: maritalStatus ? maritalStatus.toUpperCase() : null,
      occupation: occupation || null,
      placeOfWork: placeOfWork || null,
      institutionName: institutionName || null,
      institutionType: institutionType || null,
      level: level || null,
      course: course || null,
      graduationYear: graduationYear ? parseInt(graduationYear) : null,
      membershipCategory: membershipCategory || null,
      yearJoined: yearJoined ? parseInt(yearJoined) : null,
      state: state || null,
      zone: zone || null,
      branch: branch || null,
      branchId: branchId || null,
      preferredContactMethod: preferredContactMethod || null,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone ? normalizePhoneNumber(emergencyContactPhone) : null,
      ageBracket: ageBracket || null,
      isMinor,
      signupSource: 'WEB',
      guardianName: guardianName || null,
      guardianPhone: guardianPhone ? normalizePhoneNumber(guardianPhone) : null,
      guardianEmail: guardianEmail || null,
      guardianRelationship: guardianRelationship || null,
      privacyPolicyAccepted: !!privacyPolicyAccepted,
      termsAccepted: !!termsAccepted,
      consentTimestamp: new Date(),
    },
  });

  // Generate token
  const token = generateToken(authUser.id, normalizedPhone, email);

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
 * Check if user exists by email or phone
 */
export const checkUserExistence = async ({ email, phoneNumber }) => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const where = {};
  if (email) where.email = email;
  if (normalizedPhone) where.phoneNumber = normalizedPhone;

  const existingUser = await prisma.authUser.findFirst({
    where: {
      OR: [
        email ? { email } : undefined,
        normalizedPhone ? { phoneNumber: normalizedPhone } : undefined,
      ].filter(Boolean),
    },
    select: {
      id: true,
      email: true,
      phoneNumber: true,
    },
  });

  if (existingUser) {
    let message = 'User already exists';
    if (email && existingUser.email === email && phoneNumber && existingUser.phoneNumber === phoneNumber) {
      message = 'User with this email and phone number already exists';
    } else if (email && existingUser.email === email) {
      message = 'User with this email address already exists';
    } else if (phoneNumber && existingUser.phoneNumber === phoneNumber) {
      message = 'User with this phone number already exists';
    }

    return {
      exists: true,
      message,
      field: email && existingUser.email === email ? 'email' : 'phoneNumber',
    };
  }

  return {
    exists: false,
    message: 'User does not exist',
  };
};

/**
 * Login user with email and password
 */
export const loginUser = async (email, password) => {
  // Find user
  const authUser = await prisma.authUser.findUnique({
    where: { email },
  });

  if (!authUser) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check if active
  if (!authUser.isActive) {
    throw new UnauthorizedError('Account is inactive');
  }

  // Verify password
  const isValidPassword = await comparePassword(password, authUser.passwordHash);

  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
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

  // Get member with roles
  const member = await prisma.member.findFirst({
    where: { authUserId: authUser.id },
    include: {
      roleAssignments: {
        include: {
          role: true,
          unit: {
            include: { unitType: true }
          },
        },
      },
    },
  });

  const roles = member?.roleAssignments?.map((ra) => ra.role.name) || [];
  const primaryAssignment = member?.roleAssignments?.find(ra => ra.unitId);
  const unit = primaryAssignment && primaryAssignment.unit ? {
    ...primaryAssignment.unit,
    type: primaryAssignment.unit.unitType?.name
  } : null;

  return {
    id: authUser.id,
    phoneNumber: authUser.phoneNumber,
    email: authUser.email,
    member,
    roles,
    unit,
    token,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  };
};

/**
 * Send OTP to phone number or email
 */
export const sendOTP = async ({ phoneNumber, email, purpose }) => {
  try {
    console.log(`Starting sendOTP: phone=${phoneNumber}, email=${email}, purpose=${purpose}`);
    const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;

    // Check if user exists (for certain purposes)
    if (purpose !== 'REGISTRATION') {
      const authUser = await prisma.authUser.findFirst({
        where: {
          OR: [
            normalizedPhone ? { phoneNumber: normalizedPhone } : undefined,
            email ? { email } : undefined,
          ].filter(Boolean),
        },
      });

      if (!authUser) {
        console.log('User not found for OTP purpose:', purpose);
        throw new NotFoundError('User');
      }
    }

    // Invalidate previous OTPs for this identifier
    console.log('Invalidating previous OTPs...');
    await prisma.oTPToken.deleteMany({
      where: {
        OR: [
          normalizedPhone ? { phoneNumber: normalizedPhone } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean),
        purpose,
        usedAt: null,
      },
    });

    // Generate OTP
    const code = generateOTP();
    console.log('Generated code:', code);

    // Create OTP record
    console.log('Creating OTP record in DB...');
    const otpData = {
      phoneNumber: normalizedPhone,
      email: email,
      code,
      purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };

    // Find user if they exist
    const user = await prisma.authUser.findFirst({
      where: {
        OR: [
          normalizedPhone ? { phoneNumber: normalizedPhone } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean),
      },
    });

    if (user) {
      otpData.userId = user.id;
    }

    const otp = await prisma.oTPToken.create({
      data: otpData,
    });

    // TODO: Send OTP via SMS/Email provider
    if (email) {
      console.log(`OTP for email ${email}: ${code}`);
    } else {
      console.log(`OTP for ${normalizedPhone}: ${code}`);
    }

    return {
      message: 'OTP sent',
      expiresIn: '10 minutes',
      // For testing only - remove in production
      otpCode: process.env.NODE_ENV === 'development' ? code : undefined,
    };
  } catch (error) {
    console.error('Error detail in sendOTP service:');
    console.error(JSON.stringify(error, null, 2));
    console.error(error);
    throw error;
  }
};

/**
 * Verify OTP
 */
export const verifyOTP = async ({ phoneNumber, email, code, purpose }) => {
  const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;

  // Find OTP
  const otp = await prisma.oTPToken.findFirst({
    where: {
      OR: [
        normalizedPhone ? { phoneNumber: normalizedPhone } : undefined,
        email ? { email } : undefined,
      ].filter(Boolean),
      code,
      purpose,
      expiresAt: {
        gt: new Date(),
      },
      usedAt: null,
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

  // Get or create user (for login/registration purposes)
  let authUser = await prisma.authUser.findFirst({
    where: {
      OR: [
        normalizedPhone ? { phoneNumber: normalizedPhone } : undefined,
        email ? { email } : undefined,
      ].filter(Boolean),
    },
  });

  // Note: We don't necessarily create the user here anymore if it's registration
  // Registration will use the verified status to proceed.

  return {
    verified: true,
    userId: authUser?.id || null,
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

  // Get member details and roles
  const member = await prisma.member.findFirst({
    where: { authUserId: userId },
    include: {
      roleAssignments: {
        include: {
          role: true,
          unit: {
            include: { unitType: true }
          },
        },
      },
    },
  });

  const roles = member?.roleAssignments?.map((ra) => ra.role.name) || [];
  const primaryAssignment = member?.roleAssignments?.find(ra => ra.unitId);
  const unit = primaryAssignment && primaryAssignment.unit ? {
    ...primaryAssignment.unit,
    type: primaryAssignment.unit.unitType?.name
  } : null;

  return {
    ...authUser,
    member,
    roles,
    unit,
  };
};

/**
 * Request Password Reset
 * Resolves identifier (Email/Phone/FCS Code) to user and sends OTP
 */
export const requestPasswordReset = async (identifier) => {
  let authUser = null;

  const idStr = String(identifier);

  // Try finding by Email
  if (idStr.includes('@')) {
    authUser = await prisma.authUser.findUnique({
      where: { email: idStr },
    });
  }
  // Try finding by Phone
  else if (/^(\+?234|0)\d{10}$/.test(normalizePhoneNumber(idStr))) {
    authUser = await prisma.authUser.findUnique({
      where: { phoneNumber: normalizePhoneNumber(idStr) },
    });
  }
  // Try finding by FCS Code
  else {
    const member = await prisma.member.findUnique({
      where: { fcsCode: identifier },
      include: { authUser: true }
    });
    if (member) {
      authUser = member.authUser;
    }
  }

  if (!authUser) {
    // Return success even if user not found to prevent enumeration, or throw specific error?
    // For better UX during development/testing, we might throw provided error, but security best practice is generic message.
    // However, the current codebase throws NotFoundError for other cases.
    throw new NotFoundError('User not found with provided credentials');
  }

  // Send OTP to user's registered contact methods
  return await sendOTP({
    phoneNumber: authUser.phoneNumber,
    email: authUser.email,
    purpose: 'PASSWORD_RESET'
  });
};

/**
 * Reset Password
 */
export const resetPassword = async (identifier, code, newPassword) => {
  // 1. Resolve User again to ensure we verify OTP against correct phone
  let authUser = null;

  const idStr = String(identifier);

  if (idStr.includes('@')) {
    authUser = await prisma.authUser.findUnique({ where: { email: idStr } });
  } else if (/^(\+?234|0)\d{10}$/.test(normalizePhoneNumber(idStr))) {
    authUser = await prisma.authUser.findUnique({ where: { phoneNumber: normalizePhoneNumber(idStr) } });
  } else {
    const member = await prisma.member.findUnique({
      where: { fcsCode: identifier },
      include: { authUser: true }
    });
    if (member) authUser = member.authUser;
  }

  if (!authUser) {
    throw new NotFoundError('User not found');
  }

  // 2. Verify OTP
  // verifyOTP throws error if invalid.
  await verifyOTP({
    phoneNumber: authUser.phoneNumber,
    email: authUser.email,
    code,
    purpose: 'PASSWORD_RESET'
  });

  // 3. Hash New Password
  const passwordHash = await hashPassword(newPassword);

  // 4. Update Password
  await prisma.authUser.update({
    where: { id: authUser.id },
    data: { passwordHash }
  });

  // 5. Invalidate all sessions (optional but recommended)
  await prisma.authSession.updateMany({
    where: { userId: authUser.id },
    data: { revoked: true, revokedAt: new Date() }
  });

  return {
    message: 'Password reset successfully'
  };
};

/**
 * Change Password (Authenticated)
 */
export const changePassword = async (userId, currentPassword, newPassword) => {
  const authUser = await prisma.authUser.findUnique({
    where: { id: userId }
  });

  if (!authUser) {
    throw new NotFoundError('User');
  }

  const isValid = await comparePassword(currentPassword, authUser.passwordHash);
  if (!isValid) {
    throw new ValidationError('Invalid current password');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.authUser.update({
    where: { id: userId },
    data: { passwordHash }
  });

  return {
    message: 'Password changed successfully'
  };
};
