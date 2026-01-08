
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixEventSettings() {
    const eventId = 'cmjvlbwob0003o9prxbrgsn90';

    console.log(`Checking event: ${eventId}`);

    const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { settings: true }
    });

    if (!event) {
        console.error('Event not found!');
        return;
    }

    console.log('Current Event Settings:', event.settings);

    if (!event.settings) {
        console.log('No settings found. Creating default settings with allowThirdPartyRegistration=true');
        await prisma.eventSetting.create({
            data: {
                eventId: eventId,
                allowThirdPartyRegistration: true,
                allowSelfRegistration: true,
                requireGroupAssignment: false
            }
        });
    } else {
        console.log('Updating existing settings to enable allowThirdPartyRegistration...');
        await prisma.eventSetting.update({
            where: { eventId: eventId },
            data: {
                allowThirdPartyRegistration: true
            }
        });
    }

    const updated = await prisma.event.findUnique({
        where: { id: eventId },
        include: { settings: true }
    });

    console.log('Updated Event Settings:', updated.settings);
}

fixEventSettings()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
