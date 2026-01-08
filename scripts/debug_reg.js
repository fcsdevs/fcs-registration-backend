
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const id = 'cmk42cleq0009p6zlwj0atig4';
    console.log(`Checking Registration ID: ${id}`);

    const reg = await prisma.registration.findUnique({
        where: { id },
        include: {
            event: { include: { unit: true } },
            member: true,
            participation: true
        }
    });

    if (reg) {
        console.log('FOUND REGISTRATION:');
        console.log(JSON.stringify(reg, null, 2));
    } else {
        console.log('ERROR: Registration NOT FOUND in database.');
    }

    // Also check if it works with the exact search logic from service
    const searchResults = await prisma.registration.findMany({
        where: {
            OR: [
                { id: { equals: id } }
            ]
        }
    });
    console.log('Search Logic Result Count:', searchResults.length);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
