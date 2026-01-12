import Joi from 'joi';

// ============================================================
// AUTH VALIDATION SCHEMAS
// ============================================================

export const registerSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).required(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const sendOTPSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional(),
  email: Joi.string().email().optional(),
  purpose: Joi.string().valid('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'REGISTRATION').required(),
}).or('phoneNumber', 'email');

export const verifyOTPSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional(),
  email: Joi.string().email().optional(),
  code: Joi.string().length(6).required(),
}).or('phoneNumber', 'email');

export const resetPasswordSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional(),
  email: Joi.string().email().optional(),
  code: Joi.string().length(6).required(),
  newPassword: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
}).or('phoneNumber', 'email');

export const checkExistenceSchema = Joi.object({
  email: Joi.string().email().optional(),
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional(),
}).or('email', 'phoneNumber');

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
});

// ============================================================
// MEMBER VALIDATION SCHEMAS
// ============================================================

export const createMemberSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().optional(),
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional(),
  dateOfBirth: Joi.date().iso().optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional(),
  maritalStatus: Joi.string().valid('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED').optional(),
  occupation: Joi.string().optional(),
  state: Joi.string().optional(),
});

export const updateMemberSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional(),
  dateOfBirth: Joi.date().iso().optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional(),
  maritalStatus: Joi.string().valid('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED').optional(),
  occupation: Joi.string().optional(),
  state: Joi.string().optional(),
  profilePhotoUrl: Joi.string().uri().optional(),
}).min(1);

// ============================================================
// EVENT VALIDATION SCHEMAS
// ============================================================

export const createEventSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().max(1000).optional(),
  unitId: Joi.string().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  registrationStart: Joi.date().iso().required(),
  registrationEnd: Joi.date().iso().greater(Joi.ref('registrationStart')).required(),
  participationMode: Joi.string().valid('ONLINE', 'ONSITE', 'HYBRID').required(),
  capacity: Joi.number().min(1).optional(),
});

export const updateEventSchema = Joi.object({
  title: Joi.string().min(5).max(200).optional(),
  description: Joi.string().max(1000).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  registrationStart: Joi.date().iso().optional(),
  registrationEnd: Joi.date().iso().optional(),
  participationMode: Joi.string().valid('ONLINE', 'ONSITE', 'HYBRID').optional(),
  capacity: Joi.number().min(1).optional(),
}).min(1).unknown(true);

// ============================================================
// REGISTRATION VALIDATION SCHEMAS
// ============================================================

export const createRegistrationSchema = Joi.object({
  eventId: Joi.string().required(),
  memberId: Joi.string().required(),
  centerId: Joi.string().optional(),
  participationMode: Joi.string().valid('ONLINE', 'ONSITE').optional(),
});

export const assignCenterSchema = Joi.object({
  centerId: Joi.string().required(),
  participationMode: Joi.string().valid('ONLINE', 'ONSITE').required(),
});

// ============================================================
// ATTENDANCE VALIDATION SCHEMAS
// ============================================================

export const checkInSchema = Joi.object({
  eventId: Joi.string().required(),
  registrationId: Joi.string().required(),
  centerId: Joi.string().optional(),
  checkInMethod: Joi.string().valid('QR', 'SAC', 'MANUAL', 'KIOSK').required(),
  notes: Joi.string().optional(),
});

export const checkOutSchema = Joi.object({
  attendanceId: Joi.string().required(),
  notes: Joi.string().optional(),
});

export const bulkSyncSchema = Joi.object({
  records: Joi.array().items(
    Joi.object({
      eventId: Joi.string().required(),
      registrationId: Joi.string().required(),
      centerId: Joi.string().optional(),
      checkInMethod: Joi.string().valid('QR', 'SAC', 'MANUAL', 'KIOSK').required(),
      checkInTime: Joi.date().iso().required(),
      idempotencyKey: Joi.string().required(),
    })
  ).required(),
});

// ============================================================
// CENTER VALIDATION SCHEMAS
// ============================================================

export const createCenterSchema = Joi.object({
  eventId: Joi.string().required(),
  centerName: Joi.string().min(3).max(100).required(),
  country: Joi.string().default('Nigeria'),
  stateId: Joi.string().optional(),
  address: Joi.string().min(5).max(200).required(),
  capacity: Joi.number().min(1).optional(),
});

export const updateCenterSchema = Joi.object({
  centerName: Joi.string().min(3).max(100).optional(),
  address: Joi.string().min(5).max(200).optional(),
  capacity: Joi.number().min(1).optional(),
}).min(1);

// ============================================================
// PAGINATION & FILTER VALIDATION
// ============================================================

export const paginationSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
}).unknown(true);

export const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});
