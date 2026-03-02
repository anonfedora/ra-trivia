import nodemailer from 'nodemailer';

// ─────────────────────────────────────────────────────────────────────────────
// NODEMAILER (Gmail) Transport
// ─────────────────────────────────────────────────────────────────────────────
const fromName = process.env.SMTP_FROM_NAME || process.env.RESEND_FROM_NAME || 'R.A Quiz Portal';
const fromEmail = process.env.GMAIL_USER!;

const getTransporter = () =>
  nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL/TLS
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    // Force IPv4 because Render instances often have ENETUNREACH issues with IPv6
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  } as any);

// ─────────────────────────────────────────────────────────────────────────────
// RESEND (commented out – keep for potential future use)
// ─────────────────────────────────────────────────────────────────────────────
// import { Resend } from 'resend';
// const getResend = () => new Resend(process.env.RESEND_API_KEY || '');
// const resendFrom = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
//
// const resolveFromEmail = (): string => {
//   const invalidDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
//   const domain = (resendFrom.split('@')[1] || '').toLowerCase();
//   if (invalidDomains.some(d => domain.endsWith(d))) {
//     console.warn(`[EMAIL] RESEND_FROM_EMAIL uses a consumer domain. Falling back to onboarding@resend.dev`);
//     return 'onboarding@resend.dev';
//   }
//   return resendFrom;
// };
//
// const sendWithResend = async (to, subject, html, text?) => {
//   const attempt = async (from) => { try { const d = await getResend().emails.send({ from, to, subject, html, ...(text ? { text } : {}) }); return { ok: true, id: d?.data?.id }; } catch (e) { console.error('[EMAIL] Resend error:', e?.message); return { ok: false }; } };
//   const first = await attempt(`${fromName} <${resolveFromEmail()}>`);
//   if (first.ok) return true;
//   if (!resolveFromEmail().includes('onboarding@resend.dev')) { const second = await attempt(`${fromName} <onboarding@resend.dev>`); return second.ok; }
//   return false;
// };

// ─────────────────────────────────────────────────────────────────────────────
// Dev logging helper
// ─────────────────────────────────────────────────────────────────────────────
const logEmailForDev = (to: string, subject: string, html: string, otp?: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('\n📧 === DEVELOPMENT EMAIL LOG ===');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    if (otp) console.log(`OTP: ${otp}`);
    console.log(`HTML: ${html.substring(0, 200)}...`);
    console.log('=== END EMAIL LOG ===\n');
  }
  return process.env.EMAIL_SIMULATE === 'true';
};

// ─────────────────────────────────────────────────────────────────────────────
// Core send helper
// ─────────────────────────────────────────────────────────────────────────────
const sendMail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> => {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    console.log(`[EMAIL] Sent to ${to}, messageId: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error('[EMAIL] Send error:', error?.message || error);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
interface AnswerDetail {
  question: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
}

export const sendQuizResultEmail = async (
  email: string,
  name: string,
  score: number,
  details: AnswerDetail[]
): Promise<boolean> => {
  const resultRows = details
    .map(
      d => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${d.question}</td>
      <td style="padding: 10px; color: ${d.isCorrect ? '#10b981' : '#ef4444'};">${d.selectedOption}</td>
      <td style="padding: 10px;">${d.correctOption}</td>
      <td style="padding: 10px;">${d.isCorrect ? '✅' : '❌'}</td>
    </tr>
  `
    )
    .join('');

  const html = `
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
  `;
  const text = `Quiz Results for ${name}\n\nScore: ${score}%\n\nThis is an automated message.`;

  if (logEmailForDev(email, 'Your Quiz Results', html)) return true;

  const ok = await sendMail(email, 'Your Quiz Results', html, text);
  console.log(`[EMAIL] Result email to ${email}: ${ok ? 'OK' : 'FAILED'}`);
  return ok;
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString().padStart(6, '0');
};

export const sendVerificationEmail = async (
  email: string,
  name: string,
  verifyUrl?: string,
  otp?: string
): Promise<boolean> => {
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
        <div style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 4px; margin-bottom: 10px;">${otp}</div>
        <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 12px;">(Please copy and paste this code into the verification page)</p>
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

  if (logEmailForDev(email, 'Verify your email address', emailHtml, otp)) return true;

  const ok = await sendMail(
    email,
    'Verify your email address',
    emailHtml,
    `Your verification code: ${otp || ''}`
  );
  console.log(`[EMAIL] Verification email to ${email}: ${ok ? 'OK' : 'FAILED'}`);
  return ok;
};
