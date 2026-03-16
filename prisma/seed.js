import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed command started...');
  console.log('Note: High-level data is usually restored via JSON backup scripts.');
  
  // Example: Ensuring at least basic roles exist if they don't
  const roles = [
    { name: 'Admin', description: 'System Administrator' },
    { name: 'Registrar', description: 'Event Registrar' },
    { name: 'Member', description: 'General Member' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log('✅ Basic roles ensured.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
