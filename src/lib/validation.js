import Joi from 'joi';

// ============================================================
// AUTH VALIDATION SCHEMAS
// ============================================================

export const registerSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).required().messages({
    'string.pattern.base': 'Phone number must be a valid Nigerian number (e.g., 08135873345 or +2348135873345)'
  }),
  email: Joi.string().email().allow('', null).optional(),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  otherNames: Joi.string().allow('', null).optional(),
  preferredName: Joi.string().allow('', null).optional(),
  whatsappNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).allow('', null).optional().messages({
    'string.pattern.base': 'WhatsApp number must be a valid Nigerian number'
  }),
  dateOfBirth: Joi.date().iso().allow(null).optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional(),
  maritalStatus: Joi.string().valid('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED').optional(),
  occupation: Joi.string().allow('', null).optional(),
  placeOfWork: Joi.string().allow('', null).optional(),
  department: Joi.string().allow('', null).optional(),
  institutionName: Joi.string().allow('', null).optional(),
  institutionType: Joi.string().valid('PRIMARY', 'SECONDARY', 'TERTIARY', 'UNIVERSITY', 'POLYTECHNIC', 'COLLEGE_OF_EDUCATION', 'OTHER').optional(),
  level: Joi.string().allow('', null).optional(),
  course: Joi.string().allow('', null).optional(),
  graduationYear: Joi.number().optional(),
  membershipCategory: Joi.string().valid('PRIMARY', 'SECONDARY', 'TERTIARY', 'ASSOCIATE', 'STAFF').required(),
  yearJoined: Joi.number().optional(),
  state: Joi.string().optional(),
  zone: Joi.string().optional(),
  branch: Joi.string().optional(),
  branchId: Joi.string().optional(),
  preferredContactMethod: Joi.string().valid('SMS', 'EMAIL', 'WHATSAPP').optional(),
  emergencyContactName: Joi.string().allow('', null).optional(),
  emergencyContactPhone: Joi.string().pattern(/^(\+?234|0)\d{10}$/).allow('', null).optional().messages({
    'string.pattern.base': 'Emergency contact phone must be a valid Nigerian number'
  }),
  ageBracket: Joi.string().optional(),
  guardianName: Joi.string().allow('', null).optional(),
  guardianPhone: Joi.string().pattern(/^(\+?234|0)\d{10}$/).allow('', null).optional().messages({
    'string.pattern.base': 'Guardian phone must be a valid Nigerian number'
  }),
  guardianEmail: Joi.string().email().allow('', null).optional(),
  guardianRelationship: Joi.string().allow('', null).optional(),
  privacyPolicyAccepted: Joi.boolean().valid(true).required(),
  termsAccepted: Joi.boolean().valid(true).required(),
});

export const loginSchema = Joi.object({
  identifier: Joi.string().required().messages({
    'any.required': 'Email or Phone Number is required'
  }),
  password: Joi.string().required(),
});

export const sendOTPSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional().messages({
    'string.pattern.base': 'Phone number must be a valid Nigerian number (e.g., 08135873345 or +2348135873345)'
  }),
  email: Joi.string().email().optional(),
  purpose: Joi.string().valid('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'REGISTRATION').required(),
}).or('phoneNumber', 'email');

export const verifyOTPSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional().messages({
    'string.pattern.base': 'Phone number must be a valid Nigerian number (e.g., 08135873345 or +2348135873345)'
  }),
  email: Joi.string().email().optional(),
  code: Joi.string().length(6).required(),
  purpose: Joi.string().valid('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'REGISTRATION').optional(),
}).or('phoneNumber', 'email');

export const resetPasswordSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional().messages({
    'string.pattern.base': 'Phone number must be a valid Nigerian number (e.g., 08135873345 or +2348135873345)'
  }),
  email: Joi.string().email().optional(),
  code: Joi.string().length(6).required(),
  newPassword: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
}).or('phoneNumber', 'email');

export const checkExistenceSchema = Joi.object({
  email: Joi.string().email().allow('', null).optional(),
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).allow('', null).optional().messages({
    'string.pattern.base': 'Phone number must be a valid Nigerian number (e.g., 08135873345 or +2348135873345)'
  }),
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
  otherNames: Joi.string().allow('', null).optional(),
  preferredName: Joi.string().allow('', null).optional(),
  email: Joi.string().email().allow(null, '').optional(),
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional().messages({
    'string.pattern.base': 'Phone number must be a valid Nigerian number (e.g., 08135873345 or +2348135873345)'
  }),
  whatsappNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).allow('', null).optional().messages({
    'string.pattern.base': 'WhatsApp number must be a valid Nigerian number'
  }),
  dateOfBirth: Joi.date().iso().allow(null).optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional(),
  maritalStatus: Joi.string().valid('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED').optional(),
  occupation: Joi.string().allow('', null).optional(),
  placeOfWork: Joi.string().allow('', null).optional(),
  department: Joi.string().allow('', null).optional(),
  institutionName: Joi.string().allow('', null).optional(),
  institutionType: Joi.string().valid('PRIMARY', 'SECONDARY', 'TERTIARY', 'UNIVERSITY', 'POLYTECHNIC', 'COLLEGE_OF_EDUCATION', 'OTHER').allow(null, '').optional(),
  level: Joi.string().allow('', null).optional(),
  course: Joi.string().allow('', null).optional(),
  graduationYear: Joi.number().allow(null).optional(),
  membershipCategory: Joi.string().valid('PRIMARY', 'SECONDARY', 'TERTIARY', 'ASSOCIATE', 'STAFF').optional(),
  yearJoined: Joi.number().allow(null).optional(),
  state: Joi.string().allow('', null).optional(),
  zone: Joi.string().allow('', null).optional(),
  branch: Joi.string().allow('', null).optional(),
  branchId: Joi.string().allow('', null).optional(),
  preferredContactMethod: Joi.string().valid('SMS', 'EMAIL', 'WHATSAPP').optional(),
  emergencyContactName: Joi.string().allow('', null).optional(),
  emergencyContactPhone: Joi.string().pattern(/^(\+?234|0)\d{10}$/).allow('', null).optional(),
  ageBracket: Joi.string().allow('', null).optional(),
  guardianName: Joi.string().allow('', null).optional(),
  guardianPhone: Joi.string().pattern(/^(\+?234|0)\d{10}$/).allow('', null).optional().messages({
    'string.pattern.base': 'Guardian phone must be a valid Nigerian number'
  }),
  guardianEmail: Joi.string().email().allow('', null).optional(),
  guardianRelationship: Joi.string().allow('', null).optional(),
  profilePhotoUrl: Joi.string().uri().allow('', null).optional(),
});

export const updateMemberSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  otherNames: Joi.string().allow('', null).optional(),
  preferredName: Joi.string().allow('', null).optional(),
  email: Joi.string().email().allow(null, '').optional(),
  phoneNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).optional().messages({
    'string.pattern.base': 'Phone number must be a valid Nigerian number (e.g., 08135873345 or +2348135873345)'
  }),
  whatsappNumber: Joi.string().pattern(/^(\+?234|0)\d{10}$/).allow('', null).optional().messages({
    'string.pattern.base': 'WhatsApp number must be a valid Nigerian number'
  }),
  dateOfBirth: Joi.date().iso().allow(null).optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional(),
  maritalStatus: Joi.string().valid('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED').optional(),
  occupation: Joi.string().allow('', null).optional(),
  placeOfWork: Joi.string().allow('', null).optional(),
  department: Joi.string().allow('', null).optional(),
  institutionName: Joi.string().allow('', null).optional(),
  institutionType: Joi.string().valid('PRIMARY', 'SECONDARY', 'TERTIARY', 'UNIVERSITY', 'POLYTECHNIC', 'COLLEGE_OF_EDUCATION', 'OTHER').allow(null, '').optional(),
  level: Joi.string().allow('', null).optional(),
  course: Joi.string().allow('', null).optional(),
  graduationYear: Joi.number().allow(null, '').optional(),
  membershipCategory: Joi.string().valid('PRIMARY', 'SECONDARY', 'TERTIARY', 'ASSOCIATE', 'STAFF').optional(),
  yearJoined: Joi.number().allow(null, '').optional(),
  state: Joi.string().allow('', null).optional(),
  zone: Joi.string().allow('', null).optional(),
  branch: Joi.string().allow('', null).optional(),
  branchId: Joi.string().allow('', null).optional(),
  preferredContactMethod: Joi.string().valid('SMS', 'EMAIL', 'WHATSAPP').optional(),
  emergencyContactName: Joi.string().allow('', null).optional(),
  emergencyContactPhone: Joi.string().pattern(/^(\+?234|0)\d{10}$/).allow('', null).optional().messages({
    'string.pattern.base': 'Emergency contact phone must be a valid Nigerian number'
  }),
  ageBracket: Joi.string().allow('', null).optional(),
  guardianName: Joi.string().allow('', null).optional(),
  guardianPhone: Joi.string().pattern(/^(\+?234|0)\d{10}$/).allow('', null).optional().messages({
    'string.pattern.base': 'Guardian phone must be a valid Nigerian number'
  }),
  guardianEmail: Joi.string().email().allow('', null).optional(),
  guardianRelationship: Joi.string().allow('', null).optional(),
  profilePhotoUrl: Joi.string().uri().allow('', null).optional(),
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
  imageUrl: Joi.string().uri().optional(),
});

export const updateEventSchema = Joi.object({
  title: Joi.string().min(5).max(200).optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  registrationStart: Joi.date().iso().optional(),
  registrationEnd: Joi.date().iso().optional(),
  participationMode: Joi.string().valid('ONLINE', 'ONSITE', 'HYBRID').optional(),
  imageUrl: Joi.string().uri().allow('', null).optional(),
}).min(1).unknown(true);

// ============================================================
// REGISTRATION VALIDATION SCHEMAS
// ============================================================

export const createRegistrationSchema = Joi.object({
  eventId: Joi.string().required(),
  memberId: Joi.string().required(),
  centerId: Joi.string().optional(),
  participationMode: Joi.string().valid('ONLINE', 'ONSITE').optional(),
  attendanceIntent: Joi.string().valid('CONFIRMED', 'TENTATIVE').optional(),
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
});

export const updateCenterSchema = Joi.object({
  centerName: Joi.string().min(3).max(100).optional(),
  address: Joi.string().min(5).max(200).optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

// ============================================================
// PAGINATION & FILTER VALIDATION
// ============================================================

export const paginationSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(1000).default(20),
  type: Joi.string().optional(),
  parentUnitId: Joi.string().optional(),
  recursive: Joi.string().valid('true', 'false').optional(),
  search: Joi.string().optional(),
}).unknown(true);

export const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});
