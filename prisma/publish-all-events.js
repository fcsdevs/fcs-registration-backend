/**
 * Script to publish all existing events
 * This updates isPublished to true for all events in the database
 */

import { getPrismaClient } from '../src/lib/prisma.js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function publishAllEvents() {
    let prisma;
    let retries = 0;

    while (retries < MAX_RETRIES) {
        try {
            console.log(`\n🔄 Attempt ${retries + 1}/${MAX_RETRIES}: Connecting to database...`);

            prisma = getPrismaClient();

            // Test connection
            await prisma.$queryRaw`SELECT 1`;
            console.log('✅ Database connection successful!');

            // Count unpublished events
            const unpublishedCount = await prisma.event.count({
                where: { isPublished: false }
            });

            console.log(`\n📊 Found ${unpublishedCount} unpublished events`);

            if (unpublishedCount === 0) {
                console.log('✅ All events are already published!');
                console.log('\n💡 Note: All NEW events will be automatically published.');
                return;
            }

            // Update all events to published
            console.log(`\n🔄 Publishing ${unpublishedCount} events...`);
            const result = await prisma.event.updateMany({
                where: { isPublished: false },
                data: { isPublished: true }
            });

            console.log(`✅ Successfully published ${result.count} events!`);

            // Verify the update
            const totalEvents = await prisma.event.count();
            const publishedEvents = await prisma.event.count({
                where: { isPublished: true }
            });

            console.log(`\n📈 Summary:`);
            console.log(`   Total events: ${totalEvents}`);
            console.log(`   Published events: ${publishedEvents}`);
            console.log(`   Unpublished events: ${totalEvents - publishedEvents}`);

            return; // Success - exit the retry loop

        } catch (error) {
            retries++;

            if (error.code === 'P1001' || error.message.includes("Can't reach database")) {
                console.error(`\n❌ Database connection failed (attempt ${retries}/${MAX_RETRIES})`);

                if (retries < MAX_RETRIES) {
                    console.log(`⏳ Retrying in ${RETRY_DELAY / 1000} seconds...`);
                    console.log(`\n💡 Tip: If using Neon database:`);
                    console.log(`   1. Go to https://console.neon.tech`);
                    console.log(`   2. Check if your database is paused`);
                    console.log(`   3. Wake it up and try again`);
                    await sleep(RETRY_DELAY);
                } else {
                    console.error('\n💥 Failed to connect after maximum retries');
                    console.error('\n🔧 Troubleshooting steps:');
                    console.error('   1. Check your DATABASE_URL in .env file');
                    console.error('   2. Verify database is running (Neon: check console.neon.tech)');
                    console.error('   3. Check your internet connection');
                    console.error('   4. Try manually publishing events via admin dashboard');
                    console.error('\n✅ Good news: New events will auto-publish automatically!');
                    throw error;
                }
            } else {
                console.error('\n❌ Unexpected error:', error.message);
                throw error;
            }
        } finally {
            if (prisma) {
                await prisma.$disconnect();
            }
        }
    }
}

// Run the script
publishAllEvents()
    .then(() => {
        console.log('\n✨ Done! All events are now published.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n⚠️  Script completed with errors.');
        console.error('However, your backend is configured to auto-publish new events.');
        process.exit(1);
    });
