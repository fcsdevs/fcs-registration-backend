import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function checkAndRecover() {
    console.log('🔍 Checking database status for recovery...');

    try {
        // Check if there are any users in the database
        // We use AuthUser as a canary for "important data exists"
        const userCount = await prisma.authUser.count();

        if (userCount === 0) {
            console.warn('⚠️ Database appears to be EMPTY. Initiating automatic recovery from latest backup...');
            const restoreScript = path.join(__dirname, 'restore-db.js');

            // Execute the restore script
            const output = execSync(`node ${restoreScript}`).toString();
            console.log(output);
            console.log('✅ Automatic recovery completed.');
        } else {
            console.log(`✅ Database is healthy. Found ${userCount} users. Skipping recovery.`);
        }
    } catch (error) {
        console.error('❌ Recovery check failed:', error.message);
        // If DB is totally unreachable, we might want to alert, but auto-restore might not work either.
    } finally {
        await prisma.$disconnect();
    }
}

checkAndRecover();
