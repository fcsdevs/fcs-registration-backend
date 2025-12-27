import { getPrismaClient } from '../src/lib/prisma.js';

const prisma = getPrismaClient();

async function setupCorrectUnitTypes() {
    try {
        console.log('🗑️  Cleaning up existing units and unit types...');

        // Delete all units first (because of foreign key constraints)
        await prisma.unit.deleteMany({});
        console.log('✅ Deleted all units');

        // Delete all unit types
        await prisma.unitType.deleteMany({});
        console.log('✅ Deleted all unit types');

        console.log('\n📝 Creating correct unit types...');

        // Create the correct unit types with hierarchy levels
        const unitTypes = [
            { name: 'National', level: 1, description: 'National Headquarters' },
            { name: 'Regional', level: 2, description: 'Regional level' },
            { name: 'State', level: 3, description: 'State level' },
            { name: 'Zone', level: 4, description: 'Zone level' },
            { name: 'Area', level: 5, description: 'Area level' },
            { name: 'Branch', level: 6, description: 'Branch level' },
        ];

        for (const unitType of unitTypes) {
            await prisma.unitType.create({
                data: unitType,
            });
            console.log(`✅ Created unit type: ${unitType.name} (Level ${unitType.level})`);
        }

        console.log('\n✨ Unit types setup completed successfully!');
        console.log('\nHierarchy:');
        console.log('National');
        console.log('  ├── Regional');
        console.log('      ├── State');
        console.log('          ├── Zone');
        console.log('              ├── Area');
        console.log('                  └── Branch');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setupCorrectUnitTypes();
