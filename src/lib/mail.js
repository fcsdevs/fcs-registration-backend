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

/**
 * Send OTP for registration/verification
 */
export const sendOtp = async (email, code) => {
    const subject = 'Verify Your FCS Account';
    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #010030; text-align: center;">FCS Nigeria</h2>
          <p>Hello,</p>
          <p>You requested a verification code for <strong>Account Verification</strong>.</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #010030;">${code}</span>
          </div>
          <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #777; text-align: center;">&copy; ${new Date().getFullYear()} Fellowship of Christian Students (FCS) Nigeria</p>
        </div>
      `;
    return sendMail({ to: email, subject, text: `Your FCS verification code is: ${code}`, html });
};

/**
 * Send OTP for password reset
 */
export const sendPasswordOtp = async (email, code) => {
    const subject = 'Reset Your FCS Password';
    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #010030; text-align: center;">FCS Nigeria</h2>
          <p>Hello,</p>
          <p>You requested a verification code for <strong>Password Reset</strong>.</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #010030;">${code}</span>
          </div>
          <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #777; text-align: center;">&copy; ${new Date().getFullYear()} Fellowship of Christian Students (FCS) Nigeria</p>
        </div>
      `;
    return sendMail({ to: email, subject, text: `Your FCS password reset code is: ${code}`, html });
};

export default {
    sendMail,
    sendEmail,
    verifySmtp,
    sendOtp,
    sendPasswordOtp,
};
