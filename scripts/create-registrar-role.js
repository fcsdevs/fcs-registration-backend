import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createRegistrarRole() {
    try {
        console.log('Creating Registrar role...');

        const role = await prisma.role.create({
            data: {
                name: 'Registrar',
                description: 'Authorized to register members and confirm attendance',
                permissions: ['create_members', 'edit_members', 'view_members', 'check_in_members', 'check_out_members', 'verify_attendance', 'view_events'],
                isActive: true,
            },
        });

        console.log('✅ Registrar role created successfully:', role);
    } catch (error) {
        if (error.code === 'P2002') {
            console.log('ℹ️  Registrar role already exists');
        } else {
            console.error('❌ Error creating Registrar role:', error);
        }
    } finally {
        await prisma.$disconnect();
    }
}

createRegistrarRole();
