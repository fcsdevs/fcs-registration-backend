import axios from 'axios';
import logger from './logger.js';

// Central email utility using FCS Mail Service
export const sendEmail = async (toEmail, subject, emailContent) => {
    try {
        const response = await axios.post('https://fcs-mail-service.vercel.app/api/send-mail', {
            toEmail,
            subject,
            emailContent
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log("Email sent successfully:", response.data);
        return { success: true, data: response.data };
    } catch (error) {
        console.log("Email not sent:", error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
};

/**
 * Adapter for existing sendMail calls to use the new sendEmail function
 * @param {Object} options - Email options
 */
export const sendMail = async ({ to, subject, text, html }) => {
    // Determine content to send (prefer HTML if available)
    const content = html || text;
    return sendEmail(to, subject, content);
};

/**
 * Verify mail service connection (Placeholder for compatibility)
 */
export const verifySmtp = async () => {
    logger.info('✅ Mail service configured (using FCS Mail Service)');
    return true;
};

export default {
    sendMail,
    sendEmail,
    verifySmtp,
};
