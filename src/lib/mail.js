import nodemailer from 'nodemailer';
import logger from './logger.js';

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
});

/**
 * Verify SMTP connection
 */
export const verifySmtp = async () => {
    try {
        await transporter.verify();
        logger.info('✅ SMTP connection verified successfully');
        return true;
    } catch (error) {
        logger.error('❌ SMTP connection failed:', error.message);
        return false;
    }
};

/**
 * Send an email
 * @param {Object} options - Email options
 */
export const sendMail = async ({ to, subject, text, html }) => {
    // Development mode check: Only skip if explicitly in development AND SMTP_FORCE_SEND is not set
    if (process.env.NODE_ENV === 'development' && process.env.SMTP_FORCE_SEND !== 'true') {
        const hasCredentials = process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.SMTP_PASSWORD);

        // If we have credentials even in dev, we probably want to send if force send is on
        // but by default in dev we log to console
        if (!process.env.SMTP_FORCE_SEND) {
            const devMessage = `
╔════════════════════════════════════════════════════════════════════════════╗
║                        📧 DEV MODE EMAIL                                   ║
╠════════════════════════════════════════════════════════════════════════════╣
║ TO: ${to.padEnd(75 - 5)}║
║ SUBJECT: ${subject.padEnd(75 - 10)}║
╠════════════════════════════════════════════════════════════════════════════╣
║                              BODY                                          ║
║                                                                            ║
${text ? `║ ${text.substring(0, 74).padEnd(74)}║` : ''}
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
            `;
            console.log(devMessage);
            logger.info(`[DEV] Email logged to console (not sent): ${to}`);

            return {
                messageId: `dev-${Date.now()}`,
                response: 'OK (Development Mode - Email Logged)',
            };
        }
    }

    try {
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
