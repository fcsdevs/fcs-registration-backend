# FCS Registration System - Backend API Documentation

## Overview

Enterprise-grade backend for the FCS Registration System built with Node.js, Express, PostgreSQL, and Prisma ORM. 

**Tech Stack:**
- Node.js >=18.0.0
- Express.js 4.x
- PostgreSQL 14+
- Prisma ORM 5.x
- JWT Authentication
- Joi Validation

**Architecture:** Modular monolith (13 core modules, future microservices-extractable)

**Performance Targets:** 50k+/hour attendance throughput, <300ms API latency

---

## API Base URL

```
http://localhost:3000/api
```

---

## Authentication

All endpoints (except `/auth/register` and `/auth/login`) require JWT token in `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

**Token Expiry:** 7 days
**Refresh:** POST `/auth/refresh` to get new token

---

## Modules & Endpoints

### 1. AUTH Module

**Base Path:** `/api/auth`

#### Register User
```
POST /register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+234812345678",
  "password": "SecurePassword123!",
  "state": "Lagos"
}

Response: 201 Created
{
  "data": {
    "id": "user-id",
    "fcsCode": "FCS-001234",
    "email": "john@example.com",
    "name": "John Doe"
  }
}
```

#### Login
```
POST /login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}

Response: 200 OK
{
  "data": {
    "user": { "id", "name", "email" },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "refresh-token-here"
  }
}
```

#### Send OTP
```
POST /send-otp
Content-Type: application/json

{
  "email": "john@example.com"
}

Response: 200 OK
{
  "data": {
    "message": "OTP sent to email",
    "expiresIn": 600
  }
}
```

#### Verify OTP
```
POST /verify-otp
Content-Type: application/json

{
  "email": "john@example.com",
  "otp": "123456"
}

Response: 200 OK
{
  "data": {
    "verified": true,
    "token": "jwt-token"
  }
}
```

#### Refresh Token
```
POST /refresh
Authorization: Bearer <refresh_token>

Response: 200 OK
{
  "data": {
    "token": "new-jwt-token"
  }
}
```

#### Get Current User
```
GET /me
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "MEMBER"
  }
}
```

#### Logout
```
POST /logout
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "message": "Logged out successfully"
}
```

---

### 2. MEMBERS Module

**Base Path:** `/api/members`

#### Create Member
```
POST /
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+234812345679",
  "state": "Oyo",
  "dob": "1990-05-15"
}

Response: 201 Created
{
  "data": {
    "id": "member-id",
    "fcsCode": "FCS-001235",
    "name": "Jane Doe"
  }
}
```

#### List Members
```
GET /?page=1&limit=50&search=Jane&state=Lagos&isActive=true
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "member-id",
      "fcsCode": "FCS-001235",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "state": "Lagos"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

#### Search Members
```
GET /search?q=jane&limit=20
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    { "id", "name", "fcsCode", "email" }
  ]
}
```

#### Get Member by FCS Code
```
GET /code/FCS-001235
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "id": "member-id",
    "fcsCode": "FCS-001235",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "guardians": [],
    "guardianOf": []
  }
}
```

#### Get Member by ID
```
GET /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "fcsCode", "name", "email", "phone", "state", "guardians", "guardianOf" }
}
```

#### Update Member
```
PUT /:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "phone": "+234812345680",
  "state": "Oyo"
}

Response: 200 OK
{
  "data": { "id", "name", "phone", "state" },
  "message": "Member updated successfully"
}
```

#### Add Guardian
```
POST /:id/guardians
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "guardianId": "guardian-id",
  "relationshipType": "PARENT"
}

Response: 201 Created
{
  "data": { "id", "guardianId", "relationshipType" }
}
```

#### Remove Guardian
```
DELETE /:id/guardians/:guardianId
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "message": "Guardian removed"
}
```

#### Get Attendance Summary
```
GET /:id/attendance-summary
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "member": { "id", "name", "fcsCode" },
    "statistics": {
      "totalAttendance": 15,
      "attendanceRate": 75.5,
      "byMode": [
        { "mode": "ONLINE", "count": 5 },
        { "mode": "ONSITE", "count": 10 }
      ]
    }
  }
}
```

#### Deactivate Member
```
DELETE /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "isActive": false },
  "message": "Member deactivated"
}
```

---

### 3. EVENTS Module

**Base Path:** `/api/events`

#### Create Event
```
POST /
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Leadership Summit 2024",
  "description": "Annual FCS leadership event",
  "startDate": "2024-12-01T09:00:00Z",
  "endDate": "2024-12-01T17:00:00Z",
  "registrationStartDate": "2024-10-01T00:00:00Z",
  "registrationEndDate": "2024-11-30T23:59:59Z",
  "participationMode": "HYBRID",
  "unitId": "unit-id",
  "location": "Lagos",
  "capacity": 500
}

Response: 201 Created
{
  "data": {
    "id": "event-id",
    "name": "Leadership Summit 2024",
    "participationMode": "HYBRID"
  }
}
```

#### List Events
```
GET /?page=1&limit=50&search=summit&unitId=unit-id&participationMode=HYBRID&isPublished=true
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "event-id",
      "name": "Leadership Summit 2024",
      "startDate": "2024-12-01T09:00:00Z",
      "participationMode": "HYBRID",
      "registrations": 150
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 100, "pages": 2 }
}
```

#### Get Event
```
GET /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "id": "event-id",
    "name": "Leadership Summit 2024",
    "startDate": "2024-12-01T09:00:00Z",
    "endDate": "2024-12-01T17:00:00Z",
    "participationMode": "HYBRID",
    "unit": { "id", "name" },
    "centers": [],
    "settings": { "groupAssignment", "selfRegistration", "parentalConsent" }
  }
}
```

#### Update Event
```
PUT /:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Leadership Summit 2024 - Updated",
  "capacity": 600
}

Response: 200 OK
{
  "data": { "id", "name", "capacity" },
  "message": "Event updated successfully"
}
```

#### Publish Event
```
POST /:id/publish
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "isPublished": true },
  "message": "Event published"
}
```

#### Get Event Statistics
```
GET /:id/statistics
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "event": { "id", "name" },
    "overview": {
      "totalRegistrations": 150,
      "totalAttendance": 120,
      "attendanceRate": 80.0,
      "totalCenters": 3
    },
    "registrationsByMode": [
      { "mode": "ONSITE", "count": 100 },
      { "mode": "ONLINE", "count": 50 }
    ],
    "attendanceByMode": [
      { "mode": "ONSITE", "count": 90 },
      { "mode": "ONLINE", "count": 30 }
    ],
    "centerStats": [
      {
        "centerId": "center-id",
        "name": "Center A",
        "state": "Lagos",
        "capacity": 100,
        "registrations": 100,
        "attendance": 90,
        "utilizationRate": 100.0
      }
    ]
  }
}
```

#### Update Event Settings
```
PUT /:id/settings
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "groupAssignment": true,
  "selfRegistration": true,
  "parentalConsent": false
}

Response: 200 OK
{
  "data": { "id", "groupAssignment", "selfRegistration", "parentalConsent" }
}
```

---

### 4. CENTERS Module

**Base Path:** `/api/centers`

#### Create Center (ONSITE/HYBRID only)
```
POST /
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "eventId": "event-id",
  "name": "Center Lagos",
  "state": "Lagos",
  "address": "123 Main Street, Lagos",
  "capacity": 100,
  "adminIds": ["admin-id-1", "admin-id-2"]
}

Response: 201 Created
{
  "data": {
    "id": "center-id",
    "name": "Center Lagos",
    "state": "Lagos",
    "capacity": 100
  }
}
```

#### List Active Centers (for registration UI)
```
GET /active?eventId=event-id&state=Lagos
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "center-id",
      "name": "Center Lagos",
      "state": "Lagos",
      "capacity": 100,
      "spotsAvailable": 45
    }
  ]
}
```

#### List Centers
```
GET /?eventId=event-id&isActive=true&page=1&limit=50
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    { "id", "name", "state", "address", "capacity", "isActive" }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 5, "pages": 1 }
}
```

#### Get Center
```
GET /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "id": "center-id",
    "name": "Center Lagos",
    "state": "Lagos",
    "address": "123 Main Street",
    "capacity": 100,
    "event": { "id", "name" },
    "admins": [
      { "id", "name", "email" }
    ]
  }
}
```

#### Update Center
```
PUT /:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Center Lagos - Main",
  "capacity": 150
}

Response: 200 OK
{
  "data": { "id", "name", "capacity" },
  "message": "Center updated successfully"
}
```

#### Add Center Admin
```
POST /:id/admins
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "userId": "user-id"
}

Response: 201 Created
{
  "data": { "id", "userId", "centerId" }
}
```

#### Remove Center Admin
```
DELETE /:id/admins/:userId
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "message": "Admin removed"
}
```

#### Get Center Statistics
```
GET /:id/statistics
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "center": { "id", "name", "state", "capacity" },
    "event": { "id", "name" },
    "statistics": {
      "totalRegistrations": 95,
      "totalAttendance": 85,
      "attendanceRate": 89.5,
      "capacityUtilization": 95.0,
      "spotsAvailable": 5
    },
    "registrationsByMode": [
      { "mode": "ONSITE", "count": 95 }
    ],
    "attendanceByMode": [
      { "mode": "ONSITE", "count": 85 }
    ]
  }
}
```

#### Deactivate Center
```
DELETE /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "isActive": false },
  "message": "Center deactivated"
}
```

---

### 5. REGISTRATIONS Module

**Base Path:** `/api/registrations`

#### Create Registration
```
POST /
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "eventId": "event-id",
  "memberId": "member-id",
  "participationMode": "ONSITE",
  "centerId": "center-id"
}

Response: 201 Created
{
  "data": {
    "id": "registration-id",
    "memberId": "member-id",
    "eventId": "event-id",
    "participationMode": "ONSITE",
    "centerId": "center-id",
    "status": "CONFIRMED"
  }
}
```

#### List Registrations
```
GET /?eventId=event-id&memberId=member-id&centerId=center-id&status=CONFIRMED&page=1&limit=50
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "registration-id",
      "member": { "id", "name", "fcsCode" },
      "event": { "id", "name" },
      "center": { "id", "name" },
      "participationMode": "ONSITE",
      "status": "CONFIRMED"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 150, "pages": 3 }
}
```

#### Get Registration
```
GET /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "id": "registration-id",
    "member": { "id", "name", "fcsCode" },
    "event": { "id", "name" },
    "center": { "id", "name" },
    "group": { "id", "name" },
    "participationMode": "ONSITE",
    "status": "CONFIRMED"
  }
}
```

#### Update Registration Status
```
PUT /:id/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "status": "CANCELLED",
  "reason": "Member unavailable"
}

Response: 200 OK
{
  "data": { "id", "status", "reason" },
  "message": "Registration status updated"
}
```

#### Assign Center
```
POST /:id/assign-center
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "centerId": "center-id"
}

Response: 200 OK
{
  "data": { "id", "centerId", "participationMode" },
  "message": "Center assigned successfully"
}
```

#### Assign Group
```
POST /:id/assign-group
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "groupId": "group-id"
}

Response: 200 OK
{
  "data": { "id", "groupId" },
  "message": "Group assigned successfully"
}
```

#### Cancel Registration
```
DELETE /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "message": "Registration cancelled"
}
```

#### Get Event Registrations
```
GET /event/:eventId?centerId=center-id&status=CONFIRMED&page=1&limit=50
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [ { "id", "memberId", "status" } ],
  "pagination": { ... }
}
```

#### Get Member Registrations
```
GET /member/:memberId?eventId=event-id&status=CONFIRMED&page=1&limit=50
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [ { "id", "eventId", "status" } ],
  "pagination": { ... }
}
```

---

### 6. ATTENDANCE Module

**Base Path:** `/api/attendance`

#### Check In
```
POST /check-in
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "registrationId": "registration-id",
  "checkInMethod": "QR",
  "centerId": "center-id"
}

Response: 201 Created
{
  "data": {
    "id": "attendance-id",
    "registrationId": "registration-id",
    "checkInTime": "2024-12-01T09:15:00Z",
    "participationMode": "ONSITE"
  }
}
```

#### Check Out
```
POST /check-out
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "attendanceId": "attendance-id",
  "notes": "Left at 5 PM"
}

Response: 200 OK
{
  "data": {
    "id": "attendance-id",
    "checkOutTime": "2024-12-01T17:00:00Z",
    "durationSeconds": 28800
  }
}
```

#### Verify Attendance
```
POST /verify
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "attendanceId": "attendance-id"
}

Response: 200 OK
{
  "data": { "id", "isVerified": true },
  "message": "Attendance verified"
}
```

#### Bulk Sync (Offline Kiosk)
```
POST /bulk-sync
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "records": [
    {
      "idempotencyKey": "uuid-1",
      "registrationId": "registration-id",
      "checkInMethod": "KIOSK",
      "centerId": "center-id",
      "timestamp": "2024-12-01T09:15:00Z"
    }
  ]
}

Response: 207 Multi-Status
{
  "data": {
    "synced": 98,
    "duplicates": 1,
    "conflicts": 1,
    "errors": 0,
    "details": [
      {
        "idempotencyKey": "uuid-1",
        "status": "success|duplicate|conflict|error"
      }
    ]
  }
}
```

#### Get Event Attendance
```
GET /event/:eventId?centerId=center-id&verified=true&page=1&limit=50
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "attendance-id",
      "member": { "id", "name", "fcsCode" },
      "checkInTime": "2024-12-01T09:15:00Z",
      "checkOutTime": "2024-12-01T17:00:00Z",
      "participationMode": "ONSITE",
      "center": { "id", "name" }
    }
  ],
  "pagination": { ... }
}
```

#### Get Center Attendance
```
GET /event/:eventId/center/:centerId?participationMode=ONSITE&page=1&limit=50
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [ { "id", "memberId", "checkInTime", "participationMode" } ],
  "pagination": { ... }
}
```

#### Correct Attendance
```
POST /:recordId/correct
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "correctionType": "CHECK_IN_TIME",
  "newValue": "2024-12-01T09:30:00Z",
  "reason": "System error - corrected"
}

Response: 200 OK
{
  "data": {
    "id": "attendance-id",
    "correction": {
      "type": "CHECK_IN_TIME",
      "oldValue": "2024-12-01T09:15:00Z",
      "newValue": "2024-12-01T09:30:00Z"
    }
  },
  "message": "Attendance corrected successfully"
}
```

#### Get Member Attendance
```
GET /member/:memberId?eventId=event-id&fromDate=2024-01-01&toDate=2024-12-31&page=1&limit=50
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "attendance-id",
      "event": { "id", "name" },
      "checkInTime": "2024-12-01T09:15:00Z",
      "participationMode": "ONSITE"
    }
  ],
  "pagination": { ... }
}
```

#### Generate Attendance Code
```
POST /code/generate
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "eventId": "event-id",
  "codeType": "QR"
}

Response: 201 Created
{
  "data": {
    "id": "code-id",
    "code": "QR_CODE_DATA_HERE",
    "eventId": "event-id",
    "expiresAt": "2024-12-02T09:00:00Z"
  }
}
```

#### Validate Attendance Code
```
POST /code/validate
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "code": "QR_CODE_DATA_HERE"
}

Response: 200 OK
{
  "data": {
    "id": "code-id",
    "eventId": "event-id",
    "isValid": true,
    "isUsed": true
  }
}
```

---

### 7. REPORTS Module

**Base Path:** `/api/reports`

#### Get Dashboard
```
GET /dashboard
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "overview": {
      "totalMembers": 5000,
      "activeEvents": 12,
      "thisMonthRegistrations": 450,
      "thisMonthAttendance": 400,
      "attendanceRate": 88.9
    },
    "topEvents": [
      {
        "id": "event-id",
        "name": "Leadership Summit",
        "registrations": 500,
        "attendance": 450
      }
    ]
  }
}
```

#### Get Event Analytics
```
GET /events/:eventId/analytics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "event": { "id", "name", "startDate", "unit": {} },
    "overview": {
      "totalRegistrations": 500,
      "totalAttendance": 400,
      "attendanceRate": 80.0,
      "totalCenters": 3
    },
    "registrationsByMode": [
      { "mode": "ONSITE", "count": 300 },
      { "mode": "ONLINE", "count": 200 }
    ],
    "attendanceByMode": [
      { "mode": "ONSITE", "count": 270 },
      { "mode": "ONLINE", "count": 130 }
    ],
    "centerStats": [ { "centerId", "name", "registrations", "attendance", "utilizationRate" } ]
  }
}
```

#### Export Event Report
```
GET /events/:eventId/export?format=json|csv
Authorization: Bearer <jwt_token>

Response: 200 OK (JSON) | 200 OK (CSV file download)
{
  "data": {
    "exportDate": "2024-12-01T10:00:00Z",
    "event": { "id", "name" },
    "overview": { ... },
    "statistics": { ... },
    "registrations": [ { "registrationId", "member", "participationMode", "status" } ]
  }
}
```

#### Get Center Analytics
```
GET /centers/:centerId/analytics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "center": { "id", "name", "state", "address", "capacity" },
    "event": { "id", "name" },
    "statistics": {
      "totalRegistrations": 100,
      "totalAttendance": 90,
      "attendanceRate": 90.0,
      "capacityUtilization": 100.0,
      "spotsAvailable": 0
    },
    "registrationsByMode": [ ... ],
    "recentAttendance": [ { "recordId", "member", "checkInTime", "mode" } ]
  }
}
```

#### Get Member Attendance Report
```
GET /members/:memberId/attendance?eventId=event-id&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "member": { "id", "name", "fcsCode", "email", "state" },
    "statistics": {
      "totalAttendance": 20,
      "attendanceByMode": [
        { "mode": "ONLINE", "count": 8 },
        { "mode": "ONSITE", "count": 12 }
      ]
    },
    "eventAttendance": [
      {
        "event": { "id", "name", "startDate" },
        "attendance": [
          { "recordId", "center", "checkInTime", "duration", "mode" }
        ]
      }
    ]
  }
}
```

#### Get State Analytics
```
GET /states/analytics?eventId=event-id&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "memberDistribution": [
      { "state": "Lagos", "count": 1500 },
      { "state": "Oyo", "count": 800 }
    ],
    "centerDistribution": [
      { "state": "Lagos", "count": 3 },
      { "state": "Oyo", "count": 2 }
    ],
    "period": { "startDate", "endDate" }
  }
}
```

---

### 8. AUDIT Module

**Base Path:** `/api/audit`

#### Get Entity Audit Trail
```
GET /entity/:entityType/:entityId?page=1&limit=50&action=UPDATE
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "logs": [
      {
        "id": "log-id",
        "entityType": "EVENT",
        "entityId": "event-id",
        "action": "UPDATE",
        "changes": { "name": { "oldValue": "...", "newValue": "..." } },
        "userId": "user-id",
        "timestamp": "2024-12-01T10:00:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 100, "pages": 2 }
  }
}
```

#### Get User Audit Trail
```
GET /user/:userId?page=1&limit=50&entityType=REGISTRATION&action=CREATE
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "user": { "id", "name", "email" },
    "logs": [ { "id", "entityType", "entityId", "action", "timestamp" } ],
    "pagination": { ... }
  }
}
```

#### Get Audit Logs
```
GET /logs?page=1&limit=50&startDate=2024-01-01&endDate=2024-12-31&entityType=MEMBER&userId=user-id&action=DELETE
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "logs": [ { "id", "entityType", "entityId", "action", "userId", "timestamp" } ],
    "pagination": { ... }
  }
}
```

#### Get Compliance Report
```
GET /compliance/report?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "period": { "startDate", "endDate" },
    "sensitiveOperations": 150,
    "failedOperations": 5,
    "actionSummary": {
      "LOGIN": 500,
      "CREATE_ADMIN": 10,
      "ROLE_CHANGE": 20
    },
    "userSummary": {
      "user-id-1": 50,
      "user-id-2": 30
    },
    "recentSensitiveOps": [ ... ],
    "recentFailures": [ ... ]
  }
}
```

#### Get Data Change History
```
GET /history/:entityType/:entityId?field=name
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "entity": { "type": "MEMBER", "id": "member-id" },
    "field": "name",
    "history": [
      {
        "timestamp": "2024-12-01T10:00:00Z",
        "action": "UPDATE",
        "oldValue": "John Doe",
        "newValue": "John Smith",
        "changedBy": "user-id"
      }
    ]
  }
}
```

#### Export Audit Logs
```
GET /export?format=json|csv&startDate=2024-01-01&endDate=2024-12-31&entityType=EVENT&userId=user-id
Authorization: Bearer <jwt_token>

Response: 200 OK (JSON) | 200 OK (CSV file download)
```

#### Cleanup Old Logs
```
POST /retention/cleanup
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "daysRetention": 365
}

Response: 200 OK
{
  "data": {
    "deleted": 1000,
    "retentionDays": 365,
    "cutoffDate": "2023-12-01T00:00:00Z"
  }
}
```

---

### 9. GROUPS Module

**Base Path:** `/api/groups`

#### Create Group
```
POST /
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "eventId": "event-id",
  "name": "Group A",
  "type": "BIBLE_STUDY",
  "description": "Bible study session",
  "capacity": 30
}

Response: 201 Created
{
  "data": { "id": "group-id", "name": "Group A", "type": "BIBLE_STUDY", "capacity": 30 }
}
```

#### List Event Groups
```
GET /event/:eventId?page=1&limit=50&type=BIBLE_STUDY&isActive=true
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "group-id",
      "name": "Group A",
      "type": "BIBLE_STUDY",
      "capacity": 30,
      "memberCount": 25,
      "spotsAvailable": 5
    }
  ],
  "pagination": { ... }
}
```

#### Get Group
```
GET /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "id": "group-id",
    "name": "Group A",
    "type": "BIBLE_STUDY",
    "capacity": 30,
    "registrations": [ { "id", "member": { "id", "name" } } ]
  }
}
```

#### Update Group
```
PUT /:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Group A - Updated",
  "capacity": 40
}

Response: 200 OK
{
  "data": { "id", "name", "capacity" },
  "message": "Group updated successfully"
}
```

#### Get Group Members
```
GET /:id/members?page=1&limit=50
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "group": { "id", "name", "capacity", "memberCount" },
    "data": [
      {
        "registrationId": "registration-id",
        "member": { "id", "name", "fcsCode" },
        "participationMode": "ONSITE",
        "joinedAt": "2024-11-01T10:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

#### Assign Member to Group
```
POST /:id/assign
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "memberId": "member-id"
}

Response: 200 OK
{
  "data": { "id", "memberId", "groupId" },
  "message": "Member assigned to group"
}
```

#### Remove Member from Group
```
DELETE /:id/members/:memberId
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "memberId" },
  "message": "Member removed from group"
}
```

#### Bulk Assign Groups
```
POST /bulk-assign
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "eventId": "event-id",
  "strategy": "manual|auto",
  "assignments": [
    { "groupId": "group-id-1", "memberId": "member-id-1" },
    { "groupId": "group-id-2", "memberId": "member-id-2" }
  ]
}

Response: 200 OK
{
  "data": {
    "assigned": 95,
    "failed": 5,
    "errors": [ { "groupId", "memberId", "error" } ]
  }
}
```

#### Get Group Statistics
```
GET /:id/statistics
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "group": { "id", "name", "type" },
    "statistics": {
      "totalMembers": 25,
      "totalAttendance": 20,
      "attendanceRate": 80.0,
      "capacityUtilization": 83.3
    },
    "attendanceByMode": [
      { "mode": "ONSITE", "count": 20 }
    ]
  }
}
```

#### Deactivate Group
```
DELETE /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "isActive": false },
  "message": "Group deactivated"
}
```

---

### 10. UNITS Module

**Base Path:** `/api/units`

#### Create Unit
```
POST /
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Lagos District",
  "type": "DISTRICT",
  "parentUnitId": "parent-unit-id",
  "description": "Lagos District Unit",
  "leaderId": "leader-id"
}

Response: 201 Created
{
  "data": { "id": "unit-id", "name": "Lagos District", "type": "DISTRICT" }
}
```

#### List Units
```
GET /?page=1&limit=50&type=DISTRICT&parentUnitId=parent-id&search=Lagos
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "unit-id",
      "name": "Lagos District",
      "type": "DISTRICT",
      "childUnitCount": 5,
      "memberCount": 1000,
      "eventCount": 12,
      "leader": { "id", "name", "email" }
    }
  ],
  "pagination": { ... }
}
```

#### Get Unit Hierarchy
```
GET /hierarchy?rootUnitId=unit-id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "id": "unit-id",
    "name": "Lagos District",
    "type": "DISTRICT",
    "memberCount": 1000,
    "children": [
      {
        "id": "child-unit-id",
        "name": "Lagos Local 1",
        "type": "LOCAL",
        "memberCount": 300,
        "children": [ ... ]
      }
    ]
  }
}
```

#### Get Unit
```
GET /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "id": "unit-id",
    "name": "Lagos District",
    "type": "DISTRICT",
    "parentUnit": { "id", "name" },
    "childUnits": [ { "id", "name" } ],
    "leader": { "id", "name", "email" },
    "members": [ { "id", "name", "fcsCode" } ],
    "events": [ { "id", "name" } ]
  }
}
```

#### Update Unit
```
PUT /:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Lagos District - Updated",
  "leaderId": "new-leader-id"
}

Response: 200 OK
{
  "data": { "id", "name", "leader" },
  "message": "Unit updated successfully"
}
```

#### Get Child Units
```
GET /:id/children?recursive=false
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "child-unit-id",
      "name": "Lagos Local 1",
      "type": "LOCAL",
      "memberCount": 300,
      "childUnitCount": 0,
      "leader": { "id", "name" }
    }
  ]
}
```

#### Get Unit Members
```
GET /:id/members?page=1&limit=50&search=John&state=Lagos
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    { "id", "name", "fcsCode", "email", "state", "phone" }
  ],
  "unit": { "id", "name", "type" },
  "pagination": { ... }
}
```

#### Add Member to Unit
```
POST /:id/members/:memberId
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "unitId", "name" },
  "message": "Member added to unit"
}
```

#### Remove Member from Unit
```
DELETE /:id/members/:memberId
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "unitId" },
  "message": "Member removed from unit"
}
```

#### Get Unit Statistics
```
GET /:id/statistics
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "unit": { "id", "name", "type" },
    "statistics": {
      "members": 1000,
      "events": 12,
      "registrations": 5000,
      "childUnits": 5
    },
    "membersByState": [
      { "state": "Lagos", "count": 800 },
      { "state": "Oyo", "count": 200 }
    ]
  }
}
```

#### Deactivate Unit
```
DELETE /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "isActive": false },
  "message": "Unit deactivated"
}
```

---

### 11. ROLES Module

**Base Path:** `/api/roles`

#### Create Role
```
POST /
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "EVENT_ORGANIZER",
  "description": "Event organizer role",
  "permissions": ["create_events", "edit_events", "manage_centers"],
  "unitScope": false
}

Response: 201 Created
{
  "data": {
    "id": "role-id",
    "name": "EVENT_ORGANIZER",
    "permissions": [ ... ]
  }
}
```

#### List Roles
```
GET /?page=1&limit=50&search=organizer&isActive=true
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "role-id",
      "name": "EVENT_ORGANIZER",
      "description": "Event organizer role",
      "_count": { "users": 10 }
    }
  ],
  "pagination": { ... }
}
```

#### Initialize Predefined Roles
```
POST /init
Authorization: Bearer <jwt_token>

Response: 201 Created
{
  "data": [
    { "id": "admin-role-id", "name": "ADMIN" },
    { "id": "unit-leader-role-id", "name": "UNIT_LEADER" },
    { "id": "center-admin-role-id", "name": "CENTER_ADMIN" },
    { "id": "kiosk-role-id", "name": "KIOSK_OPERATOR" },
    { "id": "viewer-role-id", "name": "VIEWER" }
  ]
}
```

#### Get Role
```
GET /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "id": "role-id",
    "name": "EVENT_ORGANIZER",
    "permissions": [ ... ],
    "description": "...",
    "_count": { "users": 10 }
  }
}
```

#### Update Role
```
PUT /:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "description": "Updated description",
  "permissions": [ ... ],
  "isActive": true
}

Response: 200 OK
{
  "data": { "id", "name", "permissions" },
  "message": "Role updated successfully"
}
```

#### Assign Role to User
```
POST /:roleId/users/:userId
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "unitId": "unit-id"
}

Response: 201 Created
{
  "data": {
    "id": "assignment-id",
    "userId": "user-id",
    "roleId": "role-id",
    "unitId": "unit-id",
    "assignedAt": "2024-12-01T10:00:00Z"
  }
}
```

#### Remove Role from User
```
DELETE /:roleId/users/:userId
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "message": "Role removed from user"
}
```

#### Get Role Users
```
GET /:roleId/users?page=1&limit=50
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "role": { "id", "name" },
    "users": [
      {
        "user": { "id", "name", "email" },
        "unitId": "unit-id",
        "assignedAt": "2024-12-01T10:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

#### Get User Roles
```
GET /users/:userId
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "user": { "id", "name", "email" },
    "roles": [
      {
        "role": { "id", "name", "permissions" },
        "unitId": "unit-id",
        "assignedAt": "2024-12-01T10:00:00Z"
      }
    ]
  }
}
```

#### Get User Permissions
```
GET /users/:userId/permissions
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "userId": "user-id",
    "permissions": [
      "create_events",
      "edit_events",
      "manage_centers",
      "view_reports"
    ]
  }
}
```

#### Check Permission
```
POST /users/:userId/permissions/:permission/check
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "userId": "user-id",
    "permission": "create_events",
    "hasPermission": true
  }
}
```

#### Get Permission Groups
```
GET /permissions/groups
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "events": ["view_events", "create_events", "edit_events", "delete_events"],
    "members": ["view_members", "create_members", "edit_members"],
    "attendance": ["check_in_members", "check_out_members", "verify_attendance"],
    "reports": ["view_reports", "view_audit_logs", "export_data"],
    "administration": ["manage_users", "manage_roles", "manage_centers"]
  }
}
```

#### Deactivate Role
```
DELETE /:id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "isActive": false },
  "message": "Role deactivated"
}
```

---

### 12. NOTIFICATIONS Module

**Base Path:** `/api/notifications`

#### Create Notification Trigger
```
POST /triggers
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "eventId": "event-id",
  "triggerType": "REGISTRATION",
  "deliveryMethod": "EMAIL",
  "templateId": "template-id",
  "recipientType": "MEMBER"
}

Response: 201 Created
{
  "data": {
    "id": "trigger-id",
    "eventId": "event-id",
    "triggerType": "REGISTRATION",
    "deliveryMethod": "EMAIL"
  }
}
```

#### List Event Triggers
```
GET /triggers/event/:eventId?triggerType=REGISTRATION&deliveryMethod=EMAIL
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "trigger-id",
      "eventId": "event-id",
      "triggerType": "REGISTRATION",
      "deliveryMethod": "EMAIL",
      "isActive": true
    }
  ]
}
```

#### Get Trigger
```
GET /triggers/:triggerId
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": { "id", "eventId", "triggerType", "deliveryMethod", "isActive" }
}
```

#### Update Trigger
```
PUT /triggers/:triggerId
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "isActive": false
}

Response: 200 OK
{
  "data": { "id", "isActive" },
  "message": "Notification trigger updated"
}
```

#### Send Notification
```
POST /send
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "recipientEmail": "member@example.com",
  "deliveryMethod": "EMAIL",
  "subject": "Event Reminder",
  "message": "This is a reminder about the upcoming event",
  "triggerType": "EVENT_REMINDER"
}

Response: 201 Created
{
  "data": {
    "id": "notification-id",
    "recipientEmail": "member@example.com",
    "deliveryMethod": "EMAIL",
    "status": "PENDING"
  }
}
```

#### Send Batch Notifications
```
POST /send-batch
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "recipients": [
    { "id": "member-id-1", "email": "member1@example.com", "phone": "+234812345678" },
    { "id": "member-id-2", "email": "member2@example.com", "phone": "+234812345679" }
  ],
  "deliveryMethod": "EMAIL",
  "subject": "Event Registration Confirmed",
  "message": "Your registration has been confirmed",
  "triggerType": "REGISTRATION"
}

Response: 200 OK
{
  "data": {
    "sent": 98,
    "failed": 2,
    "details": [ { "recipientId", "status" } ]
  }
}
```

#### Get Notification History
```
GET /history?page=1&limit=50&recipientId=member-id&status=DELIVERED&triggerType=REGISTRATION
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    {
      "id": "notification-id",
      "recipientId": "member-id",
      "deliveryMethod": "EMAIL",
      "subject": "Event Reminder",
      "status": "DELIVERED",
      "createdAt": "2024-12-01T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

#### Mark as Delivered
```
PUT /:notificationId/delivered
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "id": "notification-id",
    "status": "DELIVERED",
    "deliveredAt": "2024-12-01T10:05:00Z"
  }
}
```

#### Trigger Registration Notifications
```
POST /trigger-registration/:registrationId
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": [
    { "triggerId": "trigger-id", "notificationId": "notification-id", "status": "sent|failed" }
  ]
}
```

#### Trigger Center Assignment Notifications
```
POST /trigger-center-assignment/:registrationId
Authorization: Bearer <jwt_token>

Response: 200 OK
{ "data": [ ... ] }
```

#### Trigger Group Assignment Notifications
```
POST /trigger-group-assignment/:registrationId
Authorization: Bearer <jwt_token>

Response: 200 OK
{ "data": [ ... ] }
```

#### Trigger Event Reminder Notifications
```
POST /trigger-event-reminder/:eventId
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "data": {
    "eventId": "event-id",
    "totalSent": 450,
    "totalFailed": 5
  }
}
```

---

## Error Responses

All errors follow standard format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { "field": "Additional context" }
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR`: Input validation failed (400)
- `NOT_FOUND`: Resource not found (404)
- `UNAUTHORIZED`: Missing/invalid token (401)
- `FORBIDDEN`: Insufficient permissions (403)
- `CONFLICT`: Business logic violation (409)
- `INTERNAL_SERVER_ERROR`: Unexpected error (500)

---

## Rate Limiting

- **Window:** 15 minutes
- **Max Requests:** 100 per IP
- **Header:** `X-RateLimit-Remaining`

---

## Performance Targets

- **Attendance Check-in:** <300ms (p95)
- **Bulk Sync:** <5000ms for 1000 records
- **Event Analytics:** <1000ms
- **Concurrent Users:** 100k+/month
- **Throughput:** 50k+ check-ins/hour

---

## Database Schema

See `/Backend/prisma/schema.prisma` for complete schema with 13 modules covering:
- Auth (users, sessions)
- Members (with guardians)
- Events (with participation modes)
- Centers (with capacity, admins)
- Registrations (with participation binding)
- Attendance (with audit trail)
- Groups (BIBLE_STUDY, WORKSHOP, BREAKOUT)
- Units (hierarchical org structure)
- Roles & Permissions (RBAC)
- Notifications (triggers, history)
- Audit (immutable logs)
- Reports (snapshots, exports)

---

## Development

```bash
# Install dependencies
npm install

# Run migrations
npx prisma migrate dev

# Seed data
npm run seed

# Start dev server
npm run dev

# Format code
npm run format

# Lint code
npm run lint
```

---

## Production Deployment

See `/Backend/.env.example` for required environment variables:
- DATABASE_URL
- JWT_SECRET
- OTP_SECRET
- SMTP settings (for email)
- SMS API keys
- AWS S3 credentials
- Rate limiting thresholds

---

## Support

For issues or questions, contact: `support@fcs-system.com`
