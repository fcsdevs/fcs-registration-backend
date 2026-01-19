
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The specific hierarchy data requested by the user
const AREAS_DATA = [
    // Northern Areas
    {
        name: "Abuja Area",
        states: ["Abuja (FCT)", "Niger", "Kwara", "Kogi"]
    },
    {
        name: "Adamawa Area",
        states: ["Adamawa", "Gombe", "Taraba"]
    },
    {
        name: "Kaduna Area",
        states: ["Kaduna", "Kano", "Katsina", "Jigawa"]
    },
    {
        name: "Nasarawa Area",
        states: ["Nasarawa", "Benue", "Plateau"]
    },
    {
        name: "Sokoto Area",
        states: ["Sokoto", "Kebbi", "Zamfara"]
    },
    {
        name: "Yobe Area",
        states: ["Yobe"]
    },
    // Southern/Mission Areas (Treated as Areas Level 2)
    {
        name: "South East Area",
        states: ["Anambra", "Enugu", "Ebonyi", "Imo", "Abia"]
    },
    {
        name: "South South Area",
        states: ["Cross River", "Bayelsa", "Akwa Ibom", "Rivers", "Edo", "Delta"]
    },
    {
        name: "South West Area",
        states: ["Ogun", "Oyo", "Osun", "Ondo", "Lagos", "Ekiti"]
    }
];

// Unit Levels Config
const UNIT_LEVELS = {
    'National': 1,
    'Area': 2,
    'State': 3,
    'Zone': 4,
    'Branch': 5
};


// Retry helper function
async function withRetry(fn, retries = 5, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            const isConnectionError = error.message.includes('Can\'t reach database server') ||
                error.message.includes('Connection terminated');

            if (i === retries - 1 || !isConnectionError) throw error;

            console.log(`⚠️ Connection failed. Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function main() {
    await withRetry(async () => {
        console.log('🔄 Syncing FCS Hierarchy Data...');

        // 1. Ensure Unit Types exist
        console.log('📊 Verifying Unit Types...');
        const typeMap = {};

        for (const [name, level] of Object.entries(UNIT_LEVELS)) {
            // 1. Conflict Check: Is there a UnitType with this NAME but a DIFFERENT level?
            const conflictByName = await prisma.unitType.findFirst({
                where: {
                    name: name,
                    NOT: { level: level }
                }
            });

            if (conflictByName) {
                console.log(`⚠️ Cleaning up conflicting type: ${conflictByName.name} (Level ${conflictByName.level})`);
                await prisma.unitType.update({
                    where: { id: conflictByName.id },
                    data: { name: `${name}_DEPRECATED_${Date.now()}` }
                });
            }

            // 2. Safe Upsert based on Level
            const type = await prisma.unitType.upsert({
                where: { level },
                update: { name, description: `${name} Level Unit` },
                create: {
                    name,
                    level,
                    description: `${name} Level Unit`
                },
            });

            typeMap[name] = type.id;
            console.log(`   - Verified Type: ${name} (Level ${level})`);
        }

        // 2. Ensure National Root
        console.log('🇳🇬 Syncing National Body...');

        // We try to find existing or create. We use a fixed code for National.
        const natCode = 'FCS-NAT-HQ';

        const national = await prisma.unit.upsert({
            where: { code: natCode },
            update: {
                name: 'FCS National Headquarter',
                unitTypeId: typeMap['National'],
            },
            create: {
                name: 'FCS National Headquarter',
                code: natCode,
                unitTypeId: typeMap['National'],
                description: 'The National Body of FCS Nigeria',
            }
        });
        console.log(`   - Verified National: ${national.name}`);

        // 3. Process Areas and States
        console.log('🌍 Syncing Areas and States...');

        for (const areaData of AREAS_DATA) {
            // Generate a deterministic code based on name (e.g., FCS-AREA-ABU)
            // We use the first 3 letters of the first word usually, or something distinct.
            // But some start with same letters (Sokoto, South...).
            // Let's use a cleaner slug.
            const slug = areaData.name.replace(" Area", "").replace(/\s+/g, "").toUpperCase().substring(0, 4);
            const areaCode = `FCS-AREA-${slug}`;

            let area = await prisma.unit.findFirst({
                where: {
                    OR: [
                        { code: areaCode },
                        { name: areaData.name, unitTypeId: typeMap['Area'] }
                    ]
                }
            });

            if (area) {
                // Update existng
                area = await prisma.unit.update({
                    where: { id: area.id },
                    data: {
                        name: areaData.name,
                        code: areaCode, // Enforce our standard code
                        unitTypeId: typeMap['Area'],
                        parentId: national.id, // Ensure linked to National
                        description: `Area Unit - ${areaData.name}`
                    }
                });
                console.log(`   - Updated/Verified Area: ${areaData.name} (${areaCode})`);
            } else {
                // Create new
                area = await prisma.unit.create({
                    data: {
                        name: areaData.name,
                        code: areaCode,
                        unitTypeId: typeMap['Area'],
                        parentId: national.id,
                        description: `Area Unit - ${areaData.name}`
                    }
                });
                console.log(`   - Created Area: ${areaData.name} (${areaCode})`);
            }

            // Process States for this Area
            for (const stateName of areaData.states) {
                // Standardize Name
                const finalStateName = stateName.toLowerCase().includes('state') || stateName.includes('FCT')
                    ? stateName
                    : `${stateName} State`;

                // Generate deterministic State Code
                // remove 'State', remove '(', ')', spaces
                const stateSlug = stateName.replace(" State", "").replace(/[^a-zA-Z]/g, "").toUpperCase().substring(0, 3);
                const stateCode = `FCS-STA-${stateSlug}`;

                let stateUnit = await prisma.unit.findFirst({
                    where: {
                        OR: [
                            { code: stateCode },
                            { name: finalStateName, unitTypeId: typeMap['State'] }
                        ]
                    }
                });

                if (stateUnit) {
                    // Update existing
                    await prisma.unit.update({
                        where: { id: stateUnit.id },
                        data: {
                            name: finalStateName,
                            code: stateCode,
                            unitTypeId: typeMap['State'],
                            parentId: area.id, // Ensure linked to CORRECT Area
                            description: `${finalStateName} Unit`
                        }
                    });
                    console.log(`     - Linked State: ${finalStateName} -> ${areaData.name}`);
                } else {
                    // Create new
                    await prisma.unit.create({
                        data: {
                            name: finalStateName,
                            code: stateCode,
                            unitTypeId: typeMap['State'],
                            parentId: area.id,
                            description: `${finalStateName} Unit`
                        }
                    });
                    console.log(`     - Created State: ${finalStateName}`);
                }
            }
        }

        console.log('✨ Synchronization Complete.');
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
