import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomElement = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

async function main() {
  console.log('🌱 Starting robust database seeding...');

  try {
    await prisma.$connect();
    console.log('✅ Connected to database');
  } catch (e) {
    console.error('❌ Failed to connect:', e);
    process.exit(1);
  }


  // 1. Cleanup
  console.log('🗑️  Cleaning up...');
  await prisma.attendanceRecord.deleteMany();
  await prisma.registrationParticipation.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.groupAssignment.deleteMany();
  await prisma.centerAdmin.deleteMany();
  await prisma.eventCenter.deleteMany();
  await prisma.event.deleteMany();

  await prisma.member.deleteMany();
  await prisma.roleAssignment.deleteMany();
  await prisma.role.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.authUser.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.unitType.deleteMany();

  // 2. Create Roles
  console.log('👑 Creating roles...');
  const roleDefinitions = [
    { name: 'National Admin', description: 'National level administrator', permissions: ['all'] },
    { name: 'Regional Admin', description: 'Regional level administrator', permissions: ['region_all'] },
    { name: 'State Admin', description: 'State level administrator', permissions: ['state_all'] },
    { name: 'Zone Admin', description: 'Zonal level administrator', permissions: ['zone_all'] },
    { name: 'Area Admin', description: 'Area level administrator', permissions: ['area_all'] },
    { name: 'Branch Admin', description: 'Branch/Local level administrator', permissions: ['branch_all'] },
    { name: 'Center Admin', description: 'Event Center administrator', permissions: ['center_all'] },
    { name: 'Registrar', description: 'Authorized to register members and confirm attendance', permissions: ['create_members', 'edit_members', 'view_members', 'check_in_members', 'check_out_members', 'verify_attendance', 'view_events'] },
    { name: 'Member', description: 'Regular member', permissions: ['view_self'] }
  ];

  const roles = {};
  for (const def of roleDefinitions) {
    roles[def.name] = await prisma.role.create({
      data: {
        name: def.name,
        description: def.description,
      }
    });
  }

  // 3. Create Unit Types - CORRECT HIERARCHY
  console.log('📊 Creating unit types...');
  const typeDefs = [
    { name: 'National', level: 1, description: 'National Headquarters' },
    { name: 'Regional', level: 2, description: 'Regional level' },
    { name: 'State', level: 3, description: 'State level' },
    { name: 'Zone', level: 4, description: 'Zone level' },
    { name: 'Area', level: 5, description: 'Area level' },
    { name: 'Branch', level: 6, description: 'Branch level' }
  ];
  const types = {};
  for (const t of typeDefs) {
    types[t.name] = await prisma.unitType.create({
      data: {
        name: t.name,
        level: t.level,
        description: t.description
      }
    });
  }

  // 4. Create Units Hierarchy
  console.log('🏢 Creating unit hierarchy...');
  console.log('   National → Regional → State → Zone → Area → Branch');

  // National
  const nationalHQ = await prisma.unit.create({
    data: { name: 'FCS National Headquarters', code: 'FCS-NAT-HQ', unitTypeId: types['National'].id }
  });

  // Regions
  const regions = [
    { name: 'South West Region', code: 'FCS-REG-SW' },
    { name: 'North Central Region', code: 'FCS-REG-NC' },
    { name: 'South East Region', code: 'FCS-REG-SE' },
    { name: 'North West Region', code: 'FCS-REG-NW' },
    { name: 'South South Region', code: 'FCS-REG-SS' },
    { name: 'North East Region', code: 'FCS-REG-NE' }
  ];
  const regionUnits = [];
  for (const r of regions) {
    regionUnits.push(await prisma.unit.create({
      data: { name: r.name, code: r.code, unitTypeId: types['Regional'].id, parentId: nationalHQ.id }
    }));
  }

  // States (Just a few for robust data)
  const states = ['Lagos', 'Oyo', 'FCT Abuja', 'Kaduna', 'Rivers'];
  const stateUnits = [];
  for (let i = 0; i < states.length; i++) {
    const parentRegion = regionUnits[i % regionUnits.length];
    stateUnits.push(await prisma.unit.create({
      data: { name: `${states[i]} State`, code: `FCS-STA-${states[i].substring(0, 3).toUpperCase()}`, unitTypeId: types['State'].id, parentId: parentRegion.id }
    }));
  }

  // Zones & Areas & Branches (Nested loop for density)
  const branchUnits = [];
  for (const state of stateUnits) {
    for (let z = 1; z <= 2; z++) {
      const zone = await prisma.unit.create({
        data: { name: `${state.name} Zone ${z}`, code: `${state.code}-Z${z}`, unitTypeId: types['Zone'].id, parentId: state.id }
      });

      for (let a = 1; a <= 2; a++) {
        const area = await prisma.unit.create({
          data: { name: `${zone.name} Area ${a}`, code: `${zone.code}-A${a}`, unitTypeId: types['Area'].id, parentId: zone.id }
        });

        for (let b = 1; b <= 3; b++) {
          branchUnits.push(await prisma.unit.create({
            data: { name: `${area.name} Branch ${b}`, code: `${area.code}-B${b}`, unitTypeId: types['Branch'].id, parentId: area.id }
          }));
        }
      }
    }
  }

  // 5. Create Members & Users
  console.log('👥 Creating members...');

  // 5a. Specific National Admin
  const adminPassword = await hashPassword('Zamson135');
  const superUser = await prisma.authUser.create({
    data: {
      email: 'ashaolusamson85@gmail.com',
      phoneNumber: '08000000000',
      passwordHash: adminPassword,
      isActive: true,
      emailVerified: true
    }
  });

  const superMember = await prisma.member.create({
    data: {
      authUserId: superUser.id,
      firstName: 'Ashaolu',
      lastName: 'Samson',
      email: 'ashaolusamson85@gmail.com',
      fcsCode: 'FCS-NAT-001',
      isActive: true,
      state: 'FCT Abuja',
      gender: 'MALE'
    }
  });

  await prisma.roleAssignment.create({
    data: {
      memberId: superMember.id,
      roleId: roles['National Admin'].id,
      unitId: nationalHQ.id,
      assignedBy: superUser.id
    }
  });

  // 5b. Dummy Members
  const dummyMembers = [];
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Esther', 'Daniel', 'Grace', 'Emmanuel', 'Joy'];
  const lastNames = ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez'];

  for (let i = 0; i < 50; i++) {
    const fn = getRandomElement(firstNames);
    const ln = getRandomElement(lastNames);
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`;

    // Create Auth User for 80% of members
    let authUserId = null;
    if (Math.random() > 0.2) {
      const u = await prisma.authUser.create({
        data: {
          email,
          phoneNumber: `080${getRandomInt(10000000, 99999999)}`,
          passwordHash: adminPassword, // Same password for testing
          isActive: true
        }
      });
      authUserId = u.id;
    }

    const member = await prisma.member.create({
      data: {
        authUserId,
        firstName: fn,
        lastName: ln,
        email,
        phoneNumber: `080${getRandomInt(10000000, 99999999)}`,
        fcsCode: `FCS-${getRandomInt(1000, 9999)}-${getRandomInt(1000, 9999)}`,
        gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
        state: getRandomElement(states),
        isActive: true
      }
    });
    dummyMembers.push(member);
  }

  // 6. Events
  console.log('📅 Creating events...');

  // Past Event
  const pastEvent = await prisma.event.create({
    data: {
      title: 'FCS National Conference 2024',
      description: 'The previous annual gathering.',
      unitId: nationalHQ.id,
      startDate: new Date('2024-12-10'),
      endDate: new Date('2024-12-15'),
      registrationStart: new Date('2024-01-01'),
      registrationEnd: new Date('2024-11-30'),
      participationMode: 'HYBRID',
      isPublished: true,
      createdBy: superUser.id,
      capacity: 5000
    }
  });

  // Upcoming Event
  const upcomingEvent = await prisma.event.create({
    data: {
      title: 'FCS National Conference 2025',
      description: 'The upcoming annual gathering.',
      unitId: nationalHQ.id,
      startDate: new Date('2025-12-10'),
      endDate: new Date('2025-12-15'),
      registrationStart: new Date('2025-01-01'),
      registrationEnd: new Date('2025-11-30'),
      participationMode: 'HYBRID',
      isPublished: true,
      createdBy: superUser.id,
      capacity: 6000
    }
  });

  // Create Event Centers for Upcoming Event
  const centers = [];
  for (const stateUnit of stateUnits) {
    centers.push(await prisma.eventCenter.create({
      data: {
        eventId: upcomingEvent.id,
        centerName: `${stateUnit.name} Center`,
        address: `123 Main St, ${stateUnit.name}`,
        stateId: stateUnit.id,
        capacity: 500,
        createdBy: superUser.id
      }
    }));
  }

  // 7. Registrations & Attendance
  console.log('📝 Creating registrations...');

  for (const member of dummyMembers) {
    // Register for upcoming event
    const center = getRandomElement(centers);
    const reg = await prisma.registration.create({
      data: {
        eventId: upcomingEvent.id,
        memberId: member.id,
        centerId: center.id,
        registeredBy: superUser.id,
        status: 'CONFIRMED',
        registrationDate: new Date()
      }
    });

    await prisma.registrationParticipation.create({
      data: {
        registrationId: reg.id,
        participationMode: 'ONSITE',
        centerId: center.id,
        assignedBy: superUser.id
      }
    });

    // 50% chance of being checked in already (simulating ongoing event or verify test)
    if (Math.random() > 0.5) {
      await prisma.attendanceRecord.create({
        data: {
          eventId: upcomingEvent.id,
          registrationId: reg.id,
          memberId: member.id,
          centerId: center.id,
          participationMode: 'ONSITE',
          checkInMethod: 'QR',
          checkInTime: new Date(),
          isVerified: true
        }
      });
    }
  }

  console.log('✅ Seeding completed.');
  console.log(`   - Super Admin: ashaolusamson85@gmail.com / Zamson135`);
  console.log(`   - Data: ${dummyMembers.length} members, 2 events, ${stateUnits.length} states.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
