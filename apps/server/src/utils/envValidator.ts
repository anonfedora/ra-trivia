// Validate required environment variables on startup
export const validateEnv = () => {
    const required = [
        'DATABASE_URL',
        'JWT_SECRET',
        'RESEND_API_KEY'
    ];

    // Resend (commented out – kept for potential future use)
    // const resendOptional = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_FROM_NAME'];

    const optional = [
        'SMTP_FROM_NAME',
        'RESEND_FROM_EMAIL',
        'RESEND_FROM_NAME'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.error('\nPlease check your .env file and ensure all required variables are set.');
        process.exit(1);
    }

    // Validate JWT_SECRET length
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.error('❌ JWT_SECRET is too short. It should be at least 32 characters long.');
        process.exit(1);
    }

    console.log('✅ Environment variables validated successfully');
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const fromName = process.env.SMTP_FROM_NAME || process.env.RESEND_FROM_NAME || 'R.A Quiz Portal';
    console.log(`📧 Email config (Resend): ${fromName} <${fromEmail}>`);
};
