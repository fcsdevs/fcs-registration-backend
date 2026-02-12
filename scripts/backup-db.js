import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function backup() {
    console.log('🚀 Starting Database Backup...');
    const backupData = {};

    // List of all models in schema.prisma
    const models = [
        'authUser',
        'authSession',
        'oTPToken',
        'passwordReset',
        'member',
        'guardian',
        'unitType',
        'unit',
        'role',
        'permission',
        'roleAssignment',
        'event',
        'eventSetting',
        'eventCenter',
        'centerAdmin',
        'registration',
        'registrationParticipation',
        'eventGroup',
        'groupAssignment',
        'attendanceRecord',
        'attendanceCorrection',
        'attendanceCode',
        'badge',
        'notification',
        'notificationTrigger',
        'reportingView',
        'analyticsSnapshot',
        'auditLog',
        'systemConfig',
        'invite'
    ];

    try {
        for (const model of models) {
            console.log(`📦 Backing up model: ${model}...`);
            try {
                // Use lowercase index for prisma models
                const data = await prisma[model].findMany();
                backupData[model] = data;
                console.log(`✅ ${model}: ${data.length} records`);
            } catch (err) {
                console.error(`❌ Error backing up ${model}:`, err.message);
            }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '../backups');

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const filePath = path.join(backupDir, `backup-${timestamp}.json`);
        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

        console.log('\n✨ Backup completed successfully!');
        console.log(`📂 File saved at: ${filePath}`);
    } catch (error) {
        console.error('💥 Backup failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

backup();
