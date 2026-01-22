import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

/**
 * Generate Event Tag PDF
 * @param {Object} registration - Registration object with member, event, and participation details
 * @returns {Promise<Buffer>} - PDF Buffer
 */
export const generateTagPdf = async (registration) => {
    return new Promise(async (resolve, reject) => {
        try {
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

            // Background / Border
            doc.rect(0, 0, width, height).fill('#ffffff'); // White background

            // Top Color Bar (FCS Blue-ish)
            doc.rect(0, 0, width, 40).fill('#1e40af'); // blue-800

            // --- HEADER ---
            doc.fillColor('#ffffff')
                .font('Helvetica-Bold')
                .fontSize(14)
                .text('FCS NIGERIA', 0, 15, { align: 'center' });

            // --- EVENT DETAILS ---
            const eventTitle = registration.event?.title || 'FCS Event';
            doc.fillColor('#333333')
                .font('Helvetica-Bold')
                .fontSize(10)
                .text(eventTitle.toUpperCase(), margin, 60, { align: 'center', width: width - (margin * 2) });

            doc.font('Helvetica')
                .fontSize(8)
                .text(new Date(registration.event?.startDate).toDateString(), { align: 'center' });

            // --- ATTENDEE INFO ---
            const firstName = registration.member?.firstName || '';
            const lastName = registration.member?.lastName || '';

            doc.moveDown(2);
            doc.font('Helvetica-Bold')
                .fontSize(22)
                .text(`${firstName} ${lastName}`, margin, 100, {
                    align: 'center',
                    width: width - (margin * 2)
                });

            doc.font('Helvetica-Bold')
                .fontSize(14)
                .fillColor('#1e40af')
                .text(`FCS ID: ${registration.member?.fcsCode || ''}`, { align: 'center' });

            // --- ROLE / STATUS ---
            const role = registration.status === 'CONFIRMED' || registration.status === 'CHECKED_IN' ? 'DELEGATE' : registration.status;

            doc.moveDown(1);
            doc.rect(margin + 20, doc.y, width - (margin * 2) - 40, 20)
                .fill('#f3f4f6'); // gray-100

            doc.fillColor('#000000')
                .fontSize(10)
                .font('Helvetica-Bold')
                .text(role, 0, doc.y - 15, { align: 'center' });

            // --- QR CODE ---
            // QR Content: JSON string for verification
            const qrData = JSON.stringify({
                id: registration.id,
                code: registration.member?.fcsCode,
                event: registration.eventId
            });

            const qrImage = await QRCode.toDataURL(qrData);

            // Calculate QR position (bottom center)
            const qrSize = 100;
            doc.image(qrImage, (width - qrSize) / 2, height - qrSize - 30, { width: qrSize });

            // --- FOOTER ---
            const centerName = registration.participation?.center?.centerName || 'General';
            doc.fontSize(8)
                .font('Helvetica')
                .text(centerName, 0, height - 20, { align: 'center' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
};
