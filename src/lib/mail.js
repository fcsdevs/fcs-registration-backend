import axios from 'axios';
import logger from './logger.js';

/**
 * Send an email using the external mail service
 * @param {Object} options - Email options
 */
export const sendMail = async ({ to, subject, text, html }) => {
    // Development mode check: Log to console in development unless forced
    if (process.env.NODE_ENV === 'development' && process.env.SMTP_FORCE_SEND !== 'true') {
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
            success: true,
            messageId: `dev-${Date.now()}`,
            response: 'OK (Development Mode - Email Logged)',
        };
    }

    try {
        const response = await axios.post('https://fcs-mail-service.vercel.app/api/send-mail', {
            toEmail: to,
            subject,
            emailContent: html || text
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        logger.info(`Email sent successfully to ${to}: ${JSON.stringify(response.data)}`);
        return { success: true, data: response.data };
    } catch (error) {
        const errorMessage = error.response?.data || error.message;
        logger.error(`Email not sent to ${to}:`, JSON.stringify(errorMessage));

        // Re-throw as an Error object so that existing try/catch blocks in the services 
        // (like notifications/service.js) can correctly handle the failure.
        const mailError = new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
        mailError.details = errorMessage;
        throw mailError;
    }
};

/**
 * Verify mail service connection (Placeholder for compatibility)
 */
export const verifySmtp = async () => {
    logger.info('✅ Mail service configured (using Vercel API)');
    return true;
};

export default {
    sendMail,
    verifySmtp,
};
