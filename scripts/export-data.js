const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Exporting data from Neon.tech...');
  
  // List of all your tables (adjust based on your schema.prisma)
  const tables = ['User', 'Registrant', 'Organization', 'Event', 'Registration']; 
  
  const backup = {};

  for (const table of tables) {
    try {
      backup[table] = await prisma[table.toLowerCase()].findMany();
      console.log(`✅ Exported ${backup[table].length} records from ${table}`);
    } catch (e) {
      console.log(`⚠️ Skipping table ${table} (may not exist yet)`);
    }
  }

  fs.writeFileSync('db-data-backup.json', JSON.stringify(backup, null, 2));
  console.log('\n🌟 Success! Data saved to db-data-backup.json');
}

main().catch(console.error).finally(() => prisma.$disconnect());
