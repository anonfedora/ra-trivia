import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const fromName = process.env.RESEND_FROM_NAME || 'Quiz System';

// Development email logging
const logEmailForDev = (to: string, subject: string, html: string, otp?: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('\n📧 === DEVELOPMENT EMAIL LOG ===');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    if (otp) console.log(`OTP: ${otp}`);
    console.log(`HTML: ${html.substring(0, 200)}...`);
    console.log('=== END EMAIL LOG ===\n');
  }

  return process.env.RESEND_SIMULATE === 'true';
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

export const sendVerificationEmail = async (email: string, name: string, verifyUrl?: string, otp?: string) => {
  if (verifyUrl) console.log(`[EMAIL] Verification link: ${verifyUrl}`);
  if (otp) console.log(`[EMAIL] OTP: ${otp}`);

  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #1e293b;">Action Required: Verify Your Email</h1>
      </div>
      
      <p style="font-size: 16px; color: #334155;">Hi ${name},</p>
      <p style="font-size: 16px; color: #334155;">Please use the following verification code to complete your registration and access the quiz portal.</p>
      
      ${otp ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Your 6-digit verification code:</p>
        <div style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 4px;">${otp}</div>
      </div>
      ` : ''}
      
      ${verifyUrl && !otp ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
      </div>
      
      <p style="font-size: 14px; color: #64748b; margin-top: 30px;">
        If the button above doesn't work, copy and paste this link into your browser:
      </p>
      <p style="font-size: 12px; color: #2563eb; word-break: break-all; background: #f8fafc; padding: 10px; border-radius: 4px;">
        ${verifyUrl}
      </p>
      ` : ''}
      
      <p style="margin-top: 30px; color: #94a3b8; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
        This is an automated message. Please do not reply.
      </p>
    </div>
  `;

  if (logEmailForDev(email, 'Verify your email address', emailHtml, otp)) {
    return true;
  }

  try {
    const data = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: 'Verify your email address',
      html: emailHtml
    });
    console.log(`[EMAIL] Verification sent to ${email}, ID: ${data.data?.id || 'unknown'}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send verification to', email, ':', error);
    return false;
  }
};
