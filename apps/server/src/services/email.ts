import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const fromName = process.env.RESEND_FROM_NAME || 'Quiz System';

// Development email logging - only activate when using fake API key
const logEmailForDev = (to: string, subject: string, html: string, otp?: string) => {
  if (process.env.NODE_ENV === 'development' && process.env.RESEND_API_KEY) {
    console.log('\n📧 === DEVELOPMENT EMAIL LOG ===');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    if (otp) console.log(`OTP: ${otp}`);
    console.log(`HTML: ${html.substring(0, 200)}...`);
    console.log('=== END EMAIL LOG ===\n');
    return true; // Pretend email was sent
  }
  return false;
};

interface AnswerDetail {
  question: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
}

export const sendQuizResultEmail = async (email: string, name: string, score: number, details: AnswerDetail[]) => {
  const resultRows = details.map(d => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${d.question}</td>
      <td style="padding: 10px; color: ${d.isCorrect ? '#10b981' : '#ef4444'};">${d.selectedOption}</td>
      <td style="padding: 10px;">${d.correctOption}</td>
      <td style="padding: 10px;">${d.isCorrect ? '✅' : '❌'}</td>
    </tr>
  `).join('');

  try {
    const data = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: 'Your Quiz Results',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h1 style="color: #1e293b;">Results for ${name}</h1>
          <p style="font-size: 18px;">Your final score: <strong style="color: #2563eb;">${score}%</strong></p>
          
          <h2 style="color: #334155; margin-top: 30px;">Detailed Feedback</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead style="background-color: #f8fafc;">
              <tr>
                <th style="padding: 10px; text-align: left;">Question</th>
                <th style="padding: 10px; text-align: left;">Your Answer</th>
                <th style="padding: 10px; text-align: left;">Correct</th>
                <th style="padding: 10px; text-align: left;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${resultRows}
            </tbody>
          </table>
          
          <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
            This is an automated message. Please do not reply.
          </p>
        </div>
      `
    });
    console.log(`[EMAIL] Sent to ${email}, ID: ${data.data?.id || 'unknown'}`);
  } catch (error) {
    console.error('[EMAIL] Failed to send to', email, ':', error);
  }
};

export const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString().padStart(6, '0');
};

export const sendVerificationEmail = async (email: string, name: string, verifyUrl: string, otp?: string) => {
  console.log(`[EMAIL] Verification link: ${verifyUrl}`);
  console.log(`[EMAIL] OTP: ${otp || 'N/A'}`);
  
  // Log email in development if using fake API key
  const devEmailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: white; border-radius: 50%; padding: 15px; margin-bottom: 20px;">
          <div style="font-size: 24px; font-weight: bold; color: #667eea;">RA</div>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px;">Royal Ambassadors</h1>
        <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0;">Quiz Portal</p>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hi ${name},</h2>
        <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">Please verify your email address to activate your account.</p>
        
        ${otp ? `
        <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Your 6-digit verification code is:</p>
          <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
            <div style="font-size: 32px; font-weight: bold; color: #1e293b; letter-spacing: 8px; font-family: monospace; background: #e2e8f0; padding: 15px; border-radius: 8px; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all;">${otp}</div>
            <div style="font-size: 12px; color: #64748b; text-align: center;">
              <button onclick="navigator.clipboard.writeText('${otp}').then(() => { this.textContent = 'Copied!'; setTimeout(() => { this.textContent = 'Copy Code'; }, 2000); })" style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-top: 10px; transition: all 0.3s ease;">Copy Code</button>
              <p style="margin: 5px 0 0 0; color: #94a3b8;">Click to copy to clipboard</p>
            </div>
          </div>
          <p style="margin: 10px 0 0 0; color: #64748b; font-size: 12px;">This code will expire in 10 minutes.</p>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 25px; border-radius: 10px; font-weight: 700; transition: all 0.3s ease;">Verify Email</a>
        </div>
        <p style="font-size: 14px; color: #64748b; text-align: center;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #64748b; word-break: break-all; text-align: center; background: #f8fafc; padding: 10px; border-radius: 5px;">${verifyUrl}</p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #64748b; font-size: 12px;">This is an automated message. Please do not reply.</p>
        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">© 2024 Royal Ambassadors Quiz Portal. All rights reserved.</p>
      </div>
    </div>
  `;
  
  if (logEmailForDev(email, 'Verify your email address', devEmailHtml, otp)) {
    return true;
  }
  
  try {
    const data = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: 'Verify your email address',
      html: devEmailHtml
    });
    console.log(`[EMAIL] Verification sent to ${email}, ID: ${data.data?.id || 'unknown'}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send verification to', email, ':', error);
    return false;
  }
};
