import 'dotenv/config';

export const config = {
    resend: {
        apiKey: process.env.RESEND_API_KEY!,
        fromEmail: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
        fromName: process.env.RESEND_FROM_NAME ?? 'R.A Quiz Portal',
    },
} as const;
