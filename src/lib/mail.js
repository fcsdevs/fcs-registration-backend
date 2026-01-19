import nodemailer from 'nodemailer';
import logger from './logger.js';

// Create a transporter using SMTP
// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    pool: true, // Use a pool for multiple messages
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 10000, // 10s
    greetingTimeout: 10000,   // 10s
    socketTimeout: 30000,     // 30s
});

/**
 * Verify SMTP connection
 */
export const verifySmtp = async () => {
    try {
        await transporter.verify();
        logger.info('✅ SMTP connection verified');
        return true;
    } catch (error) {
        logger.error('❌ SMTP connection failed:', error.message);
        return false;
    }
};

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @returns {Promise<Object>} - Nodemailer send result
 */
export const sendMail = async ({ to, subject, text, html }) => {
    try {
        logger.info(`📧 Attempting to send email to ${to} with subject: ${subject}`);
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_SENDER_NAME || 'FCS Nigeria'}" <${process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER}>`,
            to,
            subject,
            text,
            html,
        });

        logger.info(`Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error('Error sending email:', error);
        throw error;
    }
};

export default {
    sendMail,
};
