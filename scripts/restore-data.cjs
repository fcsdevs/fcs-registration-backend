const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    if (!fs.existsSync('db-data-backup.json')) {
        console.error('❌ Error: db-data-backup.json not found!');
        return;
    }

    const data = JSON.parse(fs.readFileSync('db-data-backup.json', 'utf8'));
    console.log('🔄 Seeding VPS database from JSON...');

    // Seeding in a logical order to satisfy foreign key constraints:
    const seedOrder = [
        'AuthUser',
        'AuthSession', 'OTPToken', 'PasswordReset',
        'UnitType', 'Role', 'Permission',
        'Unit',
        'Member',
        'Guardian', 'RoleAssignment', 'Invite', 'SystemConfig',
        'Event',
        'EventSetting', 'EventCenter', 'EventGroup',
        'CenterAdmin', 'Registration',
        'RegistrationParticipation', 'GroupAssignment',
        'AttendanceRecord', 'AttendanceCode', 'Badge',
        'Notification', 'NotificationTrigger',
        'ReportingView', 'AnalyticsSnapshot', 'AuditLog',
        'AttendanceCorrection'
    ];

    for (const table of seedOrder) {
        const records = data[table] || [];
        if (records.length === 0) continue;

        console.log(`⏳ Seeding ${table} (${records.length} records)...`);
        const modelName = table.charAt(0).toLowerCase() + table.slice(1);

        if (!prisma[modelName]) {
            console.log(`⚠️ Model ${modelName} not found in Prisma client`);
            continue;
        }

        // Process in batches or one-by-one with upsert
        for (const record of records) {
            try {
                await prisma[modelName].upsert({
                    where: { id: record.id },
                    update: record,
                    create: record,
                });
            } catch (e) {
                console.error(`❌ Error seeding ${table} (ID: ${record.id}):`, e.message);
            }
        }
        console.log(`✅ Completed ${table}`);
    }

    console.log('\n🌟 All data successfully migrated to VPS!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
