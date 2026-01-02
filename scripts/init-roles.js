import { getPrismaClient } from '../src/lib/prisma.js';

const prisma = getPrismaClient();

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

async function initRoles() {
    console.log('🔧 Initializing roles...');

    try {
        for (const def of roleDefinitions) {
            const existing = await prisma.role.findUnique({
                where: { name: def.name }
            });

            if (existing) {
                console.log(`✓ Role "${def.name}" already exists`);
            } else {
                await prisma.role.create({
                    data: {
                        name: def.name,
                        description: def.description,
                    }
                });
                console.log(`✓ Created role "${def.name}"`);
            }
        }

        console.log('✅ All roles initialized successfully!');
    } catch (error) {
        console.error('❌ Error initializing roles:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

initRoles();
