import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const fromName = process.env.RESEND_FROM_NAME || 'Quiz System';

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

export const sendVerificationEmail = async (email: string, name: string, verifyUrl: string) => {
  console.log(`[EMAIL] Verification link: ${verifyUrl}`);
  try {
    const data = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: 'Verify your email address',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h1 style="color: #1e293b;">Hi ${name},</h1>
          <p style="font-size: 16px; color: #334155;">Please verify your email address to activate your account.</p>
          <p style="margin: 24px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 700;">Verify Email</a>
          </p>
          <p style="font-size: 14px; color: #64748b;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #64748b; word-break: break-all;">${verifyUrl}</p>
          <p style="margin-top: 30px; color: #64748b; font-size: 14px;">This is an automated message. Please do not reply.</p>
        </div>
      `
    });
    console.log(`[EMAIL] Verification sent to ${email}, ID: ${data.data?.id || 'unknown'}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send verification to', email, ':', error);
    return false;
  }
};
