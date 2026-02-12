import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

/**
 * Helper to fetch image buffer from URL
 */
async function getImageBuffer(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (err) {
        console.error('Error fetching image:', url, err.message);
        return null;
    }
}

/**
 * Generate Event Tag PDF
 * @param {Object} registration - Registration object with member, event, and participation details
 * @returns {Promise<Buffer>} - PDF Buffer
 */
export const generateTagPdf = async (registration) => {
    return new Promise(async (resolve, reject) => {
        try {
            // DEBUG: Log registration data
            console.log('=== PDF GENERATION DEBUG ===');
            console.log('Registration ID:', registration?.id);
            console.log('Member:', {
                fcsCode: registration?.member?.fcsCode,
                firstName: registration?.member?.firstName,
                lastName: registration?.member?.lastName,
                profilePhotoUrl: registration?.member?.profilePhotoUrl
            });
            console.log('Event:', {
                title: registration?.event?.title,
                startDate: registration?.event?.startDate,
                imageUrl: registration?.event?.imageUrl
            });
            console.log('Participation:', {
                mode: registration?.participation?.participationMode,
                center: registration?.participation?.center?.centerName
            });
            console.log('Group Assignments:', registration?.groupAssignments);
            console.log('=== END DEBUG ===');

            const doc = new PDFDocument({
                size: 'A6', // Standard tag size (105 x 148 mm)
                margin: 0,
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // --- PAGE SETUP ---
            const width = doc.page.width;
            const height = doc.page.height;
            const margin = 20;

            // Background
            doc.rect(0, 0, width, height).fill('#ffffff');

            // --- BANNER IMAGE ---
            let headerHeight = 60;
            if (registration.event?.imageUrl) {
                const bannerBuffer = await getImageBuffer(registration.event.imageUrl);
                if (bannerBuffer) {
                    headerHeight = 80;
                    doc.image(bannerBuffer, 0, 0, { width: width, height: headerHeight, cover: [width, headerHeight] });
                    // Add a dark overlay to make white text readable
                    doc.rect(0, 0, width, headerHeight).fillColor('#000000', 0.4).fill();
                } else {
                    doc.rect(0, 0, width, headerHeight).fill('#1e40af'); // Fallback blue
                }
            } else {
                doc.rect(0, 0, width, headerHeight).fill('#1e40af'); // blue-800
            }

            // --- LOGO (TOP LEFT) ---
            // Using placeholder for now or if I can find a reliable path
            doc.fillColor('#ffffff')
                .font('Helvetica-Bold')
                .fontSize(10)
                .text('FCS NIGERIA', 15, 15);

            // --- EVENT TITLE & DATE (TOP RIGHT) ---
            const eventTitle = (registration.event?.title || 'FCS EVENT').toUpperCase();
            doc.fillColor('#ffffff')
                .font('Helvetica-Bold')
                .fontSize(12)
                .text(eventTitle, margin, 15, { align: 'right', width: width - margin * 2 });

            const eventDate = registration.event?.startDate
                ? new Date(registration.event.startDate).toLocaleDateString('en-GB')
                : '';
            doc.font('Helvetica')
                .fontSize(8)
                .text(eventDate, margin, 32, { align: 'right', width: width - margin * 2 });

            // --- PROFILE IMAGE ---
            const profileY = headerHeight + 20;
            const profileSize = 70;
            const centerX = width / 2;

            if (registration.member?.profilePhotoUrl) {
                const photoBuffer = await getImageBuffer(registration.member.profilePhotoUrl);
                if (photoBuffer) {
                    // Draw circular clip or just square for simplicity first
                    doc.save();
                    doc.circle(centerX, profileY + profileSize / 2, profileSize / 2).clip();
                    doc.image(photoBuffer, centerX - profileSize / 2, profileY, { width: profileSize, height: profileSize, cover: [profileSize, profileSize] });
                    doc.restore();
                } else {
                    // Placeholder circle
                    doc.circle(centerX, profileY + profileSize / 2, profileSize / 2).fill('#f3f4f6');
                    doc.fillColor('#9ca3af').fontSize(20).text('?', centerX - 5, profileY + 25);
                }
            } else {
                // Placeholder circle
                doc.circle(centerX, profileY + profileSize / 2, profileSize / 2).fill('#f3f4f6');
                doc.fillColor('#9ca3af').fontSize(20).text('?', centerX - 5, profileY + 25);
            }

            // --- NAME ---
            const firstName = (registration.member?.firstName || '').toUpperCase();
            const lastName = (registration.member?.lastName || '').toUpperCase();

            doc.fillColor('#0f172a')
                .font('Helvetica-Bold')
                .fontSize(18)
                .text(lastName, 0, profileY + profileSize + 10, { align: 'center' });

            doc.font('Helvetica')
                .fontSize(14)
                .text(firstName, { align: 'center' });

            // --- VENUE / CENTER LABEL ---
            const mode = (registration.participation?.participationMode || 'ONSITE').toUpperCase();
            const center = registration.participation?.center?.centerName || '';

            doc.moveDown(0.5);

            // Show venue/center section if center exists
            if (center) {
                doc.font('Helvetica')
                    .fontSize(7)
                    .fillColor('#94a3b8') // gray-400
                    .text('VENUE / CENTER', { align: 'center' });

                doc.font('Helvetica-Bold')
                    .fontSize(10)
                    .fillColor('#0f172a') // slate-900
                    .text(center, { align: 'center', width: width - 40 });

                doc.moveDown(0.3);
            }

            // Show participation mode
            doc.font('Helvetica-Bold')
                .fontSize(10)
                .fillColor('#10b981') // emerald-500
                .text(mode, { align: 'center' });

            // --- GROUPS (Bible Study / Workshop / Seminar) ---
            if (registration.groupAssignments && registration.groupAssignments.length > 0) {
                doc.moveDown(0.5);
                registration.groupAssignments.forEach((assignment) => {
                    if (assignment.group) {
                        const group = assignment.group;
                        const yPos = doc.y;
                        doc.rect(20, yPos, width - 40, 18).fill('#f1f5f9');
                        doc.fillColor('#475569')
                            .font('Helvetica-Bold')
                            .fontSize(8)
                            .text(`${group.type}: ${group.name}`, 25, yPos + 5, { align: 'center', width: width - 50 });
                        doc.moveDown(0.4);
                    }
                });
            }

            // --- QR CODE ---
            const qrData = JSON.stringify({
                id: registration.id,
                code: registration.member?.fcsCode,
                event: registration.eventId
            });

            const qrImage = await QRCode.toDataURL(qrData, {
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });

            const qrSize = 80;
            const qrY = height - qrSize - 35;
            doc.image(qrImage, (width - qrSize) / 2, qrY, { width: qrSize });

            // --- FCS CODE (Beautifully Styled) ---
            doc.fillColor('#065f46') // emerald-800
                .font('Helvetica-Bold')
                .fontSize(10)
                .text(registration.member?.fcsCode || '', 0, qrY + qrSize + 2, { align: 'center' });

            // --- SYSTEM FOOTER ---
            doc.fillColor('#94a3b8')
                .font('Helvetica')
                .fontSize(6)
                .text('FCS Registration System', 0, height - 15, { align: 'center' });

            doc.end();

        } catch (error) {
            console.error('PDF Generation Error:', error);
            reject(error);
        }
    });
};
