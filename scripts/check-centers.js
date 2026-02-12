import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCenters() {
    const centers = await prisma.eventCenter.findMany();
    console.log('Total centers in DB:', centers.length);
    if (centers.length > 0) {
        console.log('Sample center:', JSON.stringify(centers[0], null, 2));
    }

    const events = await prisma.event.findMany({
        include: { _count: { select: { centers: true } } }
    });
    console.log('Events and their center counts:');
    events.forEach(e => {
        console.log(`${e.title} (${e.id}): ${e._count.centers} centers`);
    });

    await prisma.$disconnect();
}

checkCenters();
