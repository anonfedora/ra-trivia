import { Resend } from 'resend';
import { config } from '../config';

const resend = new Resend(config.resend.apiKey);

// ─────────────────────────────────────────────────────────────────────────────
// Dev logging helper
// ─────────────────────────────────────────────────────────────────────────────
const logEmailForDev = (to: string, subject: string, html: string, otp?: string) => {
  if (process.env.NODE_ENV === 'development' || process.env.EMAIL_SIMULATE === 'true') {
    console.log('\n📧 === DEVELOPMENT EMAIL LOG ===');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    if (otp) console.log(`OTP: ${otp}`);
    console.log(`HTML: ${html.substring(0, 200)}...`);
    console.log('=== END EMAIL LOG ===\n');

    // Troubleshooting log mentioned in the guide
    console.log('Email service state:', {
      hasKey: !!config.resend.apiKey,
      keyPrefix: config.resend.apiKey?.slice(0, 7),
    });
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
  const domain = (config.resend.fromEmail.split('@')[1] || '').toLowerCase();
  const invalid = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  const safeFrom = invalid.some(d => domain.endsWith(d)) ? 'onboarding@resend.dev' : config.resend.fromEmail;

  try {
    const { data, error } = await resend.emails.send({
      from: `${config.resend.fromName} <${safeFrom}>`,
      to: [to], // Use array as per guide
      subject,
      html,
      ...(text ? { text } : {}),
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error.name, error.message);
      return false;
    }

    console.log(`[EMAIL] Resend ${to}: id=${data?.id || 'unknown'}`);
    return !!data?.id;
  } catch (err: any) {
    console.error('[EMAIL] Resend exception:', err?.message || String(err));
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

export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetUrl: string
): Promise<boolean> => {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
      <h1 style="color: #1e293b;">Reset Your Password</h1>
      <p style="font-size: 16px; color: #334155;">Hi ${name},</p>
      <p style="font-size: 16px; color: #334155;">We received a request to reset your password. Click the button below to set a new one. This link expires in <strong>15 minutes</strong>.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="font-size: 14px; color: #64748b;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <p style="font-size: 12px; color: #94a3b8; word-break: break-all; background: #f8fafc; padding: 10px; border-radius: 4px;">${resetUrl}</p>
      <p style="margin-top: 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">This is an automated message. Please do not reply.</p>
    </div>
  `;

  if (logEmailForDev(email, 'Reset your password', html)) return true;

  const ok = await sendMail(email, 'Reset your password', html, `Reset your password: ${resetUrl}`);
  console.log(`[EMAIL] Password reset email to ${email}: ${ok ? 'OK' : 'FAILED'}`);
  return ok;
};

export const generateOTP = (): string => {  return Math.floor(100000 + Math.random() * 900000).toString().padStart(6, '0');
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

export const sendBulkWelcomeEmail = async (
  email: string,
  name: string,
  password: string,
  church: string,
  association: string,
  userType: string,
  verifyUrl: string,
  otp: string
): Promise<boolean> => {
  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #1e293b;">Welcome to the R.A Quiz Portal</h1>
        <p style="font-size: 16px; color: #64748b;">You have been registered for the upcoming examinations.</p>
      </div>

      <p style="font-size: 16px; color: #334155;">Hi <strong>${name}</strong>,</p>
      <p style="font-size: 16px; color: #334155;">An account has been created for you. <strong>Please verify your email address using the code below first Note: This email is valid for 24 hours</strong>, then you can use these details to log in:</p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Registration Details</h3>
        <p style="margin: 10px 0; font-size: 14px; color: #334155;"><strong>Name:</strong> ${name}</p>
        <p style="margin: 10px 0; font-size: 14px; color: #334155;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 10px 0; font-size: 14px; color: #334155;"><strong>Password:</strong> ${password}</p>
        <p style="margin: 10px 0; font-size: 14px; color: #334155;"><strong>Church:</strong> ${church}</p>
        <p style="margin: 10px 0; font-size: 14px; color: #334155;"><strong>Association:</strong> ${association}</p>
        <p style="margin: 10px 0; font-size: 14px; color: #334155;"><strong>Examination Type:</strong> ${userType.replace(/_/g, ' ')}</p>
      </div>

      <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; color: #92400e; font-size: 14px; font-weight: bold;">Step 1: Verify Your Email</p>
        <p style="margin: 0 0 10px 0; color: #b45309; font-size: 14px;">Your 6-digit verification code:</p>
        <div style="font-size: 32px; font-weight: bold; color: #d97706; letter-spacing: 4px; margin-bottom: 10px;">${otp}</div>
        <p style="margin: 10px 0 0 0; color: #d97706; font-size: 12px;">(Enter this code on the verification page or click the link below)</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify & Login Now</a>
      </div>

      <p style="font-size: 14px; color: #64748b; margin-top: 30px;">
        If the button above doesn't work, copy and paste this link into your browser:
      </p>
      <p style="font-size: 12px; color: #2563eb; word-break: break-all; background: #f8fafc; padding: 10px; border-radius: 4px;">
        ${verifyUrl}
      </p>

      <p style="margin-top: 30px; color: #94a3b8; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
        This is an automated message from the R.A Quiz Portal. Please keep your login details secure.
      </p>
    </div>
  `;

  if (logEmailForDev(email, 'Welcome to R.A Quiz Portal - Your Login Details', emailHtml, otp)) return true;

  const ok = await sendMail(
    email,
    'Welcome to R.A Quiz Portal - Your Login Details',
    emailHtml,
    `Welcome ${name}. Your login password is: ${password}. Verification code: ${otp}`
  );
  console.log(`[EMAIL] Bulk welcome email to ${email}: ${ok ? 'OK' : 'FAILED'}`);
  return ok;
};
