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
import crypto from 'crypto';
import { sendMail, sendOtp, sendPasswordOtp } from '../../lib/mail.js';

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

  // 1. Check uniqueness of identifiers (Phone/Email) if provided
  const identifierFilters = [];
  if (normalizedPhone) identifierFilters.push({ phoneNumber: normalizedPhone });
  if (email) identifierFilters.push({ email });

  if (identifierFilters.length > 0) {
    const existingUser = await prisma.authUser.findFirst({
      where: { OR: identifierFilters },
    });

    if (existingUser) {
      if (normalizedPhone && existingUser.phoneNumber === normalizedPhone) {
        throw new ValidationError('User with this phone number already exists');
      }
      if (email && existingUser.email === email) {
        throw new ValidationError('User with this email already exists');
      }
    }
  }

  // 2. Uniqueness of Detail (Fallback for users without identifiers, e.g., children)
  // Check if a member with same firstName, lastName AND dateOfBirth already exists
  if (firstName && lastName && dateOfBirth) {
    const existingMember = await prisma.member.findFirst({
      where: {
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' },
        dateOfBirth: new Date(dateOfBirth),
        isActive: true
      }
    });

    if (existingMember) {
      throw new ValidationError('A member with this name and date of birth is already registered');
    }
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
      phoneNumber: normalizedPhone || null,
      email: email || null,
      passwordHash,
      emailVerified: email ? false : true, // Only require verification if email is provided
      phoneVerified: normalizedPhone ? true : true, // Currently phone is verified by default or skipped
    },
  });

  // If email supplied, send OTP for verification
  if (email) {
    await sendOTP({ email, purpose: 'REGISTRATION' });
  }

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

  // Create default role assignment for new user with HRBAC
  // If branchId is provided, assign as Branch Member with that branch scope
  // Otherwise, assign as Member with no administrative scope
  if (branchId) {
    try {
      const memberRole = await prisma.role.findFirst({
        where: { name: 'Member' }
      });

      if (memberRole) {
        await prisma.roleAssignment.create({
          data: {
            memberId: member.id,
            roleId: memberRole.id,
            unitId: branchId,
            assignedBy: authUser.id,
            assignedAt: new Date(),
            // No managedBy since this is self-signup, not admin-assigned
          }
        });
      }
    } catch (err) {
      // Silently continue if role assignment fails - not critical for signup
      console.warn('Failed to assign default role on signup:', err.message);
    }
  }

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
    centers: [],
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

  const searchTerms = [];
  if (email) searchTerms.push({ email });
  if (normalizedPhone) searchTerms.push({ phoneNumber: normalizedPhone });

  if (searchTerms.length === 0) {
    return {
      exists: false,
      message: 'No identifiers provided',
    };
  }

  const existingUser = await prisma.authUser.findFirst({
    where: {
      OR: searchTerms,
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
 * Login user with email/phone and password
 */
export const loginUser = async (identifier, password) => {
  // Normalize if it looks like a phone number
  const normalizedPhone = normalizePhoneNumber(identifier);

  // Find user by email, phone, or FCS Code
  let authUser = await prisma.authUser.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: 'insensitive' } },
        { phoneNumber: normalizedPhone },
        {
          members: {
            some: { fcsCode: { equals: identifier, mode: 'insensitive' } }
          }
        }
      ]
    },
  });

  if (!authUser) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Check if active
  if (!authUser.isActive) {
    throw new UnauthorizedError('Account is inactive');
  }

  // Verify password
  const isValidPassword = await comparePassword(password, authUser.passwordHash);

  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid credentials');
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

  // Get Center Admin assignments
  const centerAdmins = await prisma.centerAdmin.findMany({
    where: { userId: authUser.id },
    include: {
      center: {
        select: {
          id: true,
          centerName: true,
          eventId: true
        }
      }
    }
  });

  return {
    id: authUser.id,
    phoneNumber: authUser.phoneNumber,
    email: authUser.email,
    member,
    roles,
    unit,
    centers: centerAdmins.map(ca => ca.center),
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
    const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;

    let authUser = null;
    // Check if user exists (for certain purposes)
    if (purpose !== 'REGISTRATION') {
      authUser = await prisma.authUser.findFirst({
        where: {
          OR: [
            normalizedPhone ? { phoneNumber: normalizedPhone } : undefined,
            email ? { email: { equals: email, mode: 'insensitive' } } : undefined,
          ].filter(Boolean),
        },
      });

      if (!authUser) {
        throw new NotFoundError('User');
      }
    }

    // Invalidate previous OTPs for this identifier (Background task)
    prisma.oTPToken.deleteMany({
      where: {
        OR: [
          normalizedPhone ? { phoneNumber: normalizedPhone } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean),
        purpose,
        usedAt: null,
      },
    }).catch(err => console.error('Background OTP invalidation error:', err));

    // Generate OTP
    const code = generateOTP();

    // Create OTP record
    const otpData = {
      phoneNumber: normalizedPhone,
      email: email,
      code,
      purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };

    // Use previously found user if available, otherwise do a quick lookup
    const targetUser = authUser || await prisma.authUser.findFirst({
      where: {
        OR: [
          normalizedPhone ? { phoneNumber: normalizedPhone } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean),
      },
      select: { id: true }
    });

    if (targetUser) {
      otpData.userId = targetUser.id;
    }

    const otp = await prisma.oTPToken.create({
      data: otpData,
    });

    // Send OTP via Email if provided
    if (email) {
      // Send OTP via Email if provided (Asynchronous to prevent blocking/timeouts)
      const mailPromise = purpose === 'PASSWORD_RESET'
        ? sendPasswordOtp(email, code)
        : sendOtp(email, code);

      mailPromise.then(() => {
        // Success
      }).catch(mailError => {
        console.error('Failed to send OTP email:', mailError);
      });
    }

    if (normalizedPhone) {
      // TODO: Implement SMS sending (e.g. via Twilio or Termii)
    }

    return {
      message: 'OTP sent',
      expiresIn: '10 minutes',
    };
  } catch (error) {
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

  // If purpose is REGISTRATION and we have an email, mark it as verified
  if (purpose === 'REGISTRATION' && email && authUser) {
    await prisma.authUser.update({
      where: { id: authUser.id },
      data: { emailVerified: true }
    });
  }

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

  // Get Center Admin assignments
  const centerAdmins = await prisma.centerAdmin.findMany({
    where: { userId },
    include: {
      center: {
        select: {
          id: true,
          centerName: true,
          eventId: true
        }
      }
    }
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
    centers: centerAdmins.map(ca => ca.center)
  };
};

/**
 * Request Password Reset
 * Resolves identifier (Email/Phone/FCS Code) to user and sends OTP
 */
export const requestPasswordReset = async (identifier) => {
  let authUser = null;

  const idStr = String(identifier).trim();
  console.log(`[AUTH_SERVICE] Requesting password reset for identifier: "${idStr}"`);

  // Try finding by Email
  if (idStr.includes('@')) {
    authUser = await prisma.authUser.findFirst({
      where: { email: { equals: idStr, mode: 'insensitive' } },
    });
  }
  // Try finding by Phone
  else if (/^(\+?234|0)\d{10}$/.test(normalizePhoneNumber(idStr))) {
    authUser = await prisma.authUser.findFirst({
      where: { phoneNumber: normalizePhoneNumber(idStr) },
    });
  }
  // Try finding by FCS Code
  else {
    const member = await prisma.member.findFirst({
      where: { fcsCode: { equals: idStr, mode: 'insensitive' } },
      include: { authUser: true }
    });
    if (member) {
      authUser = member.authUser;
    }
  }

  if (!authUser) {
    throw new NotFoundError('User');
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
    authUser = await prisma.authUser.findFirst({ where: { email: { equals: idStr, mode: 'insensitive' } } });
  } else if (/^(\+?234|0)\d{10}$/.test(normalizePhoneNumber(idStr))) {
    authUser = await prisma.authUser.findFirst({ where: { phoneNumber: normalizePhoneNumber(idStr) } });
  } else {
    const member = await prisma.member.findFirst({
      where: { fcsCode: { equals: identifier, mode: 'insensitive' } },
      include: { authUser: true }
    });
    if (member) authUser = member.authUser;
  }

  if (!authUser) {
    throw new NotFoundError('User');
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
/**
 * Search for accounts for recovery by FCS Code or Full Name
 * @param {Object} params - Search parameters (fcsCode or fullName)
 */
export const searchRecoveryAccounts = async ({ fcsCode, fullName }) => {
  const where = {};
  if (fcsCode) {
    where.fcsCode = { equals: fcsCode, mode: 'insensitive' };
  } else if (fullName) {
    const nameParts = fullName.trim().split(/\s+/);
    where.AND = nameParts.map(part => ({
      OR: [
        { firstName: { contains: part, mode: 'insensitive' } },
        { lastName: { contains: part, mode: 'insensitive' } },
        { preferredName: { contains: part, mode: 'insensitive' } },
      ]
    }));
  } else {
    throw new ValidationError('FCS Code or Full Name is required for search');
  }

  const accounts = await prisma.member.findMany({
    where,
    select: {
      id: true,
      fcsCode: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      email: true,
      phoneNumber: true,
    },
    take: 10,
  });

  if (accounts.length === 0) {
    throw new NotFoundError('No matching accounts');
  }

  // Mask sensitive information
  return accounts.map(account => ({
    memberId: account.id,
    fcsCode: account.fcsCode,
    name: `${account.firstName} ${account.lastName}`,
    email: account.email ? `${account.email.substring(0, 3)}***${account.email.substring(account.email.indexOf('@'))}` : null,
    phoneNumber: account.phoneNumber ? `${account.phoneNumber.substring(0, 4)}***${account.phoneNumber.slice(-3)}` : null,
  }));
};

/**
 * Verify account recovery using Date of Birth
 * @param {string} memberId - ID of the member
 * @param {string} dob - Date of Birth (YYYY-MM-DD)
 */
export const verifyRecoveryDob = async (memberId, dob) => {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { authUser: true },
  });

  if (!member || !member.authUser) {
    throw new NotFoundError('Account');
  }

  if (!member.dateOfBirth) {
    throw new ValidationError('This account does not have a registered Date of Birth. Please use the Email OTP recovery method.');
  }

  const providedDob = new Date(dob);
  const storedDob = new Date(member.dateOfBirth);

  if (providedDob.toISOString().split('T')[0] !== storedDob.toISOString().split('T')[0]) {
    throw new ValidationError('Incorrect Date of Birth provided');
  }

  // Generate a secure one-time token for password reset
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.passwordReset.create({
    data: {
      userId: member.authUser.id,
      token,
      expiresAt,
    },
  });

  return {
    token,
    message: 'Identity verified successfully. You can now reset your password.',
  };
};

/**
 * Reset password using a valid recovery token
 * @param {string} token - Recovery token from DOB verification
 * @param {string} newPassword - New password
 */
export const resetPasswordByToken = async (token, newPassword) => {
  const resetRecord = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
    throw new ValidationError('Invalid or expired recovery token');
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password and mark token as used
  await prisma.$transaction([
    prisma.authUser.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    }),
    prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
    // Also revoke sessions
    prisma.authSession.updateMany({
      where: { userId: resetRecord.userId },
      data: { revoked: true, revokedAt: new Date() },
    }),
  ]);

  return {
    message: 'Password reset successfully',
  };
};
