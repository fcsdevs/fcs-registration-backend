# 🌱 Database Seeding Guide

## Overview

This guide explains how to populate your FCS Registration System database with comprehensive test data.

## What Gets Created

The seed script creates a complete, realistic dataset including:

### 📊 Organizational Structure
- **5 Unit Types**: National HQ, Regional, State, Local, Cell
- **8 Units**: 
  - 1 National HQ (Abuja)
  - 3 Regional Offices (South West, South East, North Central)
  - 4 State Offices (Lagos, Oyo, Anambra, FCT)

### 👥 Users & Members
- **101 Users** (1 admin + 100 regular users)
- **101 Members** with complete profiles
- Distributed across different states
- Mix of active and inactive members
- 80% verified users

### 📅 Events
- **5 Events**:
  1. National Conference 2024 (Past)
  2. National Conference 2025 (Upcoming - HYBRID)
  3. South West Regional Retreat (Upcoming - ONSITE)
  4. Lagos Bible Study Summit (Upcoming - ONSITE)
  5. Online Training Series - Leadership (Upcoming - ONLINE)

### 📍 Event Centers
- **5 Centers**:
  - Lagos Convention Center (600 capacity)
  - Abuja International Conference Center (400 capacity)
  - Port Harcourt Event Hall (200 capacity)
  - Ibadan Retreat Center (500 capacity)
  - Lagos Study Center (250 capacity)

### 👨‍👩‍👧‍👦 Groups
- **15 Groups**:
  - 10 Bible Study Groups (15 capacity each)
  - 5 Workshop Groups (25 capacity each)

### 📝 Registrations
- **~270 Registrations** across all events
- Mix of ONLINE and ONSITE participation
- Distributed across different centers
- All with CONFIRMED status

### ✅ Attendance Records
- **~50 Attendance Records**
- 70% attendance rate simulation
- Mix of QR_CODE and SAC_LOOKUP check-in methods

### 👥 Group Assignments
- **~60 Group Member Assignments**
- Members distributed across Bible study and workshop groups

## Running the Seed Script

### Prerequisites

1. **Database Connection**: Ensure your `.env` file has a valid `DATABASE_URL`
2. **Migrations**: Run all migrations first
3. **Clean Database**: The script will clear existing data

### Step-by-Step Instructions

#### 1. Navigate to Backend Directory
```bash
cd /home/sam/Desktop/Work/FCS/fcs-registration-backend
```

#### 2. Install Dependencies (if not already done)
```bash
npm install
```

#### 3. Run Migrations
```bash
npm run db:migrate
```

#### 4. Run the Seed Script
```bash
npm run db:seed
```

### Expected Output

You should see output like this:

```
🌱 Starting database seeding...

🗑️  Clearing existing data...
✅ Existing data cleared

📊 Creating unit types...
✅ Created 5 unit types

🏢 Creating organizational units...
✅ Created organizational units

👥 Creating users and members...
✅ Created 101 users and 101 members

📅 Creating events...
✅ Created 5 events

📍 Creating event centers...
✅ Created 5 event centers

👨‍👩‍👧‍👦 Creating groups...
✅ Created 15 groups

📝 Creating registrations...
✅ Created 270 registrations

✅ Creating attendance records...
✅ Created 50 attendance records

👥 Assigning members to groups...
✅ Created 60 group assignments

🎉 Database seeding completed successfully!

📊 Summary:
   - Unit Types: 5
   - Units: 8
   - Users: 101
   - Members: 101
   - Events: 5
   - Centers: 5
   - Groups: 15
   - Registrations: 270
   - Attendance Records: 50
   - Group Assignments: 60

🔑 Test Credentials:
   Email: admin@fcs.org
   Password: admin123
```

## Test Credentials

### Admin Account
- **Email**: `admin@fcs.org`
- **Password**: `admin123`
- **Phone**: `+2348012345678`

### Regular User Accounts
- **Email Pattern**: `firstname.lastnameN@example.com` (where N is 0-99)
- **Password**: `password123` (for all users)
- **Phone Pattern**: `+234800000000N`

### Example Regular Users
- `john.adebayo0@example.com` / `password123`
- `mary.okonkwo1@example.com` / `password123`
- `david.ibrahim2@example.com` / `password123`

## Data Characteristics

### Realistic Distribution
- **Geographic**: Members spread across Lagos, Ibadan, Onitsha, and Abuja
- **Gender**: ~50/50 male/female split
- **Age Range**: Born between 1970-2005
- **Verification**: 80% verified, 20% unverified
- **Membership**: 90% active, 10% inactive

### Event Participation
- **National Conference 2025**: ~80 registrations
- **Regional Retreat**: ~40 registrations
- **Online Training**: ~150 registrations
- **Participation Modes**: Mix of ONLINE, ONSITE, and HYBRID

### Attendance Patterns
- **Check-in Rate**: ~70% of registrations have attendance
- **Methods**: 50% QR Code, 50% SAC Lookup
- **Timing**: Random check-in times within event dates

## Dashboard Statistics

After seeding, your dashboard will show:

- **Total Members**: 101
- **Active Events**: 5
- **Attendance Rate**: ~70%
- **This Month Registrations**: Varies based on current date
- **Top Events**: National Conference 2025, Online Training Series

## Verifying the Seed Data

### Using Prisma Studio
```bash
npm run db:studio
```

This opens a web interface at `http://localhost:5555` where you can browse all seeded data.

### Using the API

1. **Login**:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@fcs.org", "password": "admin123"}'
```

2. **Get Dashboard Stats**:
```bash
curl http://localhost:5000/api/reports/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **List Events**:
```bash
curl http://localhost:5000/api/events \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **List Members**:
```bash
curl http://localhost:5000/api/members \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Re-seeding the Database

To clear and re-seed:

```bash
# Option 1: Reset and re-seed
npm run db:reset
npm run db:seed

# Option 2: Just run seed (it clears data automatically)
npm run db:seed
```

## Customizing the Seed Data

Edit `/prisma/seed.js` to customize:

- **Number of members**: Change the loop count (currently 100)
- **Event details**: Modify event objects
- **Registration patterns**: Adjust registration logic
- **Attendance rate**: Change the probability (currently 70%)
- **Names and locations**: Update the arrays

## Troubleshooting

### Error: "Can't reach database server"
- **Solution**: Check your `DATABASE_URL` in `.env`
- Ensure the database is running

### Error: "Unique constraint failed"
- **Solution**: The script clears data first, but if it fails:
```bash
npm run db:reset
npm run db:seed
```

### Error: "Module not found"
- **Solution**: Install dependencies:
```bash
npm install
```

### Slow Performance
- **Normal**: Seeding 100+ members takes 30-60 seconds
- **Too Slow**: Check database connection and server resources

## Production Warning

⚠️ **NEVER run this seed script in production!**

This script:
- Deletes ALL existing data
- Creates test accounts with known passwords
- Is for development/testing only

## Next Steps

After seeding:

1. **Login to Frontend**: Use `admin@fcs.org` / `admin123`
2. **Explore Dashboard**: See real statistics
3. **Browse Events**: View the 5 seeded events
4. **Check Members**: See 101 members with profiles
5. **View Registrations**: See event registrations
6. **Test Attendance**: View attendance records

## Support

If you encounter issues:
1. Check the console output for specific errors
2. Verify database connection
3. Ensure all migrations are run
4. Try resetting the database first

---

**Last Updated**: December 18, 2025  
**Script Version**: 1.0.0  
**Compatible With**: Prisma Schema v1.0
