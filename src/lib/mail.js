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
 * Send OTP for account registration
 * @param {string} email 
 * @param {string} OTP 
 */
export const sendOtp = async (email, OTP) => {
    const subject = "FCS Nigeria Verification Code (OTP)";
    const emailContent = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Email Verification - FCS Nigeria</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%); margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; padding: 10px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); position: relative;">
          <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 50%; width: 90px; height: 90px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; padding: 15px;">
            <img src="https://res.cloudinary.com/drnnznsbi/image/upload/fcs_gitbdj.jpg" alt="FCS Nigeria Logo" style="display: block; width: 100px; height: auto; border-radius: 50%;" />
          </div>
          <h1 style="color: white; font-size: 32px; margin: 0; font-weight: 700; letter-spacing: -0.5px;">Verify Your Email</h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0; font-weight: 300;">FCS Nigeria App</p>
        </div>
        
        <div style="padding: 45px 35px;">
                  <h2 style="color: #1a1a1a; font-size: 22px; font-weight: 600; margin: 0 0 20px 0;">Hello ${email}!</h2>
                  
                  <p style="color: #4a5568; font-size: 16px; line-height: 1.7; margin: 0 0 15px 0;">
                    Thank you for registering with the <strong style="color: #667eea;">FCS Nigeria App</strong>. We're excited to have you join our community!
                  </p>
                  
                  <p style="color: #4a5568; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                    To complete your registration, please enter the verification code below:
                  </p>
                  
                  <!-- OTP Code Box -->
                  <table role="presentation" style="width: 100%; margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 3px; border-radius: 12px; display: inline-block;">
                          <div style="background: white; border-radius: 10px; padding: 25px 40px;">
                            <p style="color: #64748b; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 8px 0;">Your Verification Code</p>
                            <div style="font-size: 36px; letter-spacing: 8px; font-weight: 700; color: #667eea; font-family: 'Courier New', monospace; margin: 0;">
                              ${OTP}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Timer Info -->
                  <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; margin: 30px 0; border-radius: 12px; border-left: 4px solid #f59e0b;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="font-size: 24px;">⏰</div>
                        </td>
                        <td>
                          <p style="color: #78350f; font-size: 14px; margin: 0; line-height: 1.6;">
                            <strong>Important:</strong> This code will expire in <strong>10 minutes</strong>. Please enter it soon to verify your account.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </div>
                  
                  <!-- Security Notice -->
                  <div style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 18px; margin: 25px 0; border-radius: 12px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="font-size: 24px;">🔒</div>
                        </td>
                        <td>
                          <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.6;">
                            If you didn't request this verification code, please ignore this email. Your account remains secure.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </div>
                  
          <p style="color: #64748b; font-size: 15px; margin: 30px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            With heartfelt gratitude,
          </p>
          <p style="color: #1a1a1a; font-size: 17px; font-weight: 700; margin: 5px 0 0 0;">FCS Nigeria Team</p>
        </div>
        
        <div style="text-align: center; padding: 25px; background-color: #f1f5f9; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0 0 5px 0;">© ${new Date().getFullYear()} FCS Nigeria. All rights reserved.</p>
          <p style="margin: 0;">If you have any questions, please contact us at <a href="mailto:info@fcsnigeria.org" style="color: #667eea; text-decoration: none;">info@fcsnigeria.org</a></p>
        </div>
      </div>
    </body>
  </html>
    `;

    return await sendEmail(email, subject, emailContent);
};

/**
 * Send OTP for password reset
 * @param {string} email 
 * @param {string} OTP 
 */
export const sendPasswordOtp = async (email, OTP) => {
    const subject = "FCS Nigeria Password Reset Verification Code";
    const emailContent = `
       <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Email Verification - FCS Nigeria</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%); margin: 0; padding: 0;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" style="width: 100%; max-width: 600px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 10px 30px;">
                  <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 50%; width: 90px; height: 90px; margin: 0 auto 20px; display: inline-flex; align-items: center; justify-content: center;">
                    <img src="https://res.cloudinary.com/drnnznsbi/image/upload/fcs_gitbdj.jpg" alt="FCS Nigeria Logo" style="display: block; width: 100px; height: auto; border-radius: 50%;" />
                  </div>
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Verify Your Email</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 15px; font-weight: 300;">FCS Nigeria App</p>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 45px 35px;">
                  <h2 style="color: #1a1a1a; font-size: 22px; font-weight: 600; margin: 0 0 20px 0;">Hello ${email}! 👋</h2>
                  
                  <p style="color: #4a5568; font-size: 16px; line-height: 1.7; margin: 0 0 15px 0;">
                    You requested a password reset for your <strong style="color: #667eea;">FCS Nigeria App</strong> account.
                  </p>
                  
                  <p style="color: #4a5568; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                    Please enter the verification code below to proceed:
                  </p>
                  
                  <!-- OTP Code Box -->
                  <table role="presentation" style="width: 100%; margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 3px; border-radius: 12px; display: inline-block;">
                          <div style="background: white; border-radius: 10px; padding: 25px 40px;">
                            <p style="color: #64748b; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 8px 0;">Your Verification Code</p>
                            <div style="font-size: 36px; letter-spacing: 8px; font-weight: 700; color: #667eea; font-family: 'Courier New', monospace; margin: 0;">
                              ${OTP}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Timer Info -->
                  <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; margin: 30px 0; border-radius: 12px; border-left: 4px solid #f59e0b;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="font-size: 24px;">⏰</div>
                        </td>
                        <td>
                          <p style="color: #78350f; font-size: 14px; margin: 0; line-height: 1.6;">
                            <strong>Important:</strong> This code will expire in <strong>10 minutes</strong>. Please enter it soon to verify your account.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </div>
                  
                  <!-- Security Notice -->
                  <div style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 18px; margin: 25px 0; border-radius: 12px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="font-size: 24px;">🔒</div>
                        </td>
                        <td>
                          <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.6;">
                            If you didn't request this verification code, please ignore this email. Your account remains secure.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </div>
                  
                  <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-size: 15px; margin: 0;">With love,</p>
                    <p style="color: #1e293b; font-size: 18px; font-weight: 700; margin: 8px 0 0 0;">Fellowship of Christian Students (FCS), Nigeria Team</p>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px;">
                  <p style="color: #94a3b8; font-size: 13px; margin: 0 0 15px 0;">
                    Need help? Contact us at <a href="mailto:info@fcsnigeria.org" style="color: #667eea; text-decoration: none; font-weight: 500;">info@fcsnigeria.org</a>
                  </p>
                  <div style="padding-top: 15px; border-top: 1px solid rgba(148, 163, 184, 0.2);">
                    <p style="color: #cbd5e1; font-size: 14px; margin: 0; font-style: italic; font-weight: 500;">Jesus is Lord.</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
    `;

    return await sendEmail(email, subject, emailContent);
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
    sendOtp,
    sendPasswordOtp
};
