import { Resend } from 'resend';

const getResend = () => new Resend(process.env.RESEND_API_KEY || '');
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

// Resolve safe "from" email for Resend (avoid consumer domains)
const resolveFromEmail = (): string => {
  const invalidDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  const chosen = fromEmail;
  const domain = (chosen.split('@')[1] || '').toLowerCase();
  if (invalidDomains.some(d => domain.endsWith(d))) {
    console.warn(`[EMAIL] RESEND_FROM_EMAIL uses a consumer domain (${domain}). Falling back to onboarding@resend.dev`);
    return 'onboarding@resend.dev';
  }
  return chosen;
};

const sendWithFallback = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> => {
  const primaryFrom = `${fromName} <${resolveFromEmail()}>`;
  const fallbackFrom = `${fromName} <onboarding@resend.dev>`;

  const attempt = async (fromHeader: string): Promise<{ ok: boolean; id?: string }> => {
    try {
      const data = await getResend().emails.send({
        from: fromHeader,
        to,
        subject,
        html,
        ...(text ? { text } : {})
      });
      const id = (data as any)?.data?.id;
      if (!id) {
        console.warn('[EMAIL] Send succeeded but no message id returned');
      }
      return { ok: true, id };
    } catch (error: any) {
      const msg = (error && error.message) ? error.message : String(error);
      console.error('[EMAIL] Send error:', msg);
      return { ok: false };
    }
  };

  const first = await attempt(primaryFrom);
  if (first.ok) return true;

  if (!primaryFrom.includes('onboarding@resend.dev')) {
    console.warn('[EMAIL] Retrying send with onboarding@resend.dev fallback');
    const second = await attempt(fallbackFrom);
    return second.ok;
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
  const text = `Quiz Results for ${name}\n\nScore: ${score}%\n\nThis is an automated message. Please do not reply.`;

  if (logEmailForDev(email, 'Your Quiz Results', html)) {
    return true;
  }

  const ok = await sendWithFallback(email, 'Your Quiz Results', html, text);
  console.log(`[EMAIL] Result email to ${email}: ${ok ? 'OK' : 'FAILED'}`);
  return ok;
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

  if (logEmailForDev(email, 'Verify your email address', emailHtml, otp)) {
    return true;
  }

  const ok = await sendWithFallback(email, 'Verify your email address', emailHtml, `Your verification code: ${otp || ''}`);
  console.log(`[EMAIL] Verification email to ${email}: ${ok ? 'OK' : 'FAILED'}`);
  return ok;
};
