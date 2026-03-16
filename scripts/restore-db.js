import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function restore(backupFileName) {
    const backupDir = path.join(__dirname, '../backups');
    const filePath = backupFileName
        ? path.join(backupDir, backupFileName)
        : fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse()[0]; // Get latest backup

    if (!filePath || !fs.existsSync(filePath)) {
        console.error('❌ No backup file found to restore.');
        return;
    }

    console.log(`🚀 Starting Database Restore from: ${filePath}...`);

    try {
        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Order matters due to foreign key constraints. 
        // This is a simplified list; in a real scenario, you'd want to handle dependencies carefully.
        const models = [
            'unitType',
            'role',
            'permission',
            'authUser',
            'member',
            'unit',
            'event',
            'eventSetting',
            'eventCenter',
            'registration',
            // ... add others or use the backup file's keys
        ];

        // Combine models from backup that aren't in the priority list
        const remainingModels = Object.keys(backupData).filter(m => !models.includes(m));
        const orderedModels = [...models, ...remainingModels];

        for (const model of orderedModels) {
            if (!backupData[model] || backupData[model].length === 0) continue;

            console.log(`📥 Restoring model: ${model} (${backupData[model].length} records)...`);

            const totalToRestore = backupData[model].length;
            const completedIds = new Set();
            let lastError = null;

            // For models like 'unit' which have self-referencing parentId, we might need multiple passes
            const maxPasses = model === 'unit' ? 10 : 1;
            
            for (let pass = 1; pass <= maxPasses; pass++) {
                let passSuccesses = 0;
                
                for (const item of backupData[model]) {
                    if (completedIds.has(item.id)) continue;

                    try {
                        await prisma[model].upsert({
                            where: { id: item.id },
                            update: item,
                            create: item,
                        });
                        completedIds.add(item.id);
                        passSuccesses++;
                    } catch (err) {
                        lastError = err.message;
                    }
                }

                if (passSuccesses > 0 && completedIds.size < totalToRestore) {
                    // console.log(`   ✅ Pass ${pass}: +${passSuccesses} records (Total: ${completedIds.size}/${totalToRestore})`);
                } else if (completedIds.size === totalToRestore) {
                    break;
                } else if (passSuccesses === 0) {
                    // No progress made this pass
                    break;
                }
            }
            
            if (completedIds.size === totalToRestore) {
                console.log(`✅ ${model} restored completely (${completedIds.size} records).`);
            } else {
                console.warn(`⚠️ ${model} restored with issues. Successes: ${completedIds.size}/${totalToRestore}. Last Error: ${lastError}`);
            }
        }

        console.log('\n✨ Restore completed successfully!');
    } catch (error) {
        console.error('💥 Restore failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Check if a filename was passed as argument
const args = process.argv.slice(2);
restore(args[0]);
