const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Exporting data from Neon.tech...');

    // List of all tables from schema.prisma
    const tables = [
        'AuthUser', 'AuthSession', 'OTPToken', 'PasswordReset',
        'Member', 'Guardian', 'UnitType', 'Unit',
        'Role', 'Permission', 'RoleAssignment',
        'Event', 'EventSetting', 'EventCenter', 'CenterAdmin',
        'Registration', 'RegistrationParticipation', 'EventGroup', 'GroupAssignment',
        'AttendanceRecord', 'AttendanceCorrection', 'AttendanceCode',
        'Badge', 'Notification', 'NotificationTrigger',
        'ReportingView', 'AnalyticsSnapshot', 'AuditLog',
        'SystemConfig', 'Invite'
    ];

    const backup = {};

    for (const table of tables) {
        try {
            const modelName = table.charAt(0).toLowerCase() + table.slice(1);
            if (prisma[modelName]) {
                backup[table] = await prisma[modelName].findMany();
                console.log(`✅ Exported ${backup[table].length} records from ${table}`);
            } else {
                console.log(`⚠️ Model ${modelName} not found in Prisma client`);
            }
        } catch (e) {
            console.log(`❌ Error exporting ${table}:`, e.message);
        }
    }

    fs.writeFileSync('db-data-backup.json', JSON.stringify(backup, null, 2));
    console.log('\n🌟 Success! Data saved to db-data-backup.json');
}

main().catch(console.error).finally(() => prisma.$disconnect());
