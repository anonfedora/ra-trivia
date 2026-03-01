// Validate required environment variables on startup
export const validateEnv = () => {
    const required = [
        'DATABASE_URL',
        'JWT_SECRET',
        'RESEND_API_KEY'
    ];

    const optional = [
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

    // Validate JWT_SECRET is not the default
    if (process.env.JWT_SECRET === 'your-secret-key' || process.env.JWT_SECRET === 'your_jwt_secret_here') {
        console.error('❌ JWT_SECRET is set to a default value. Please use a secure random string.');
        console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
        process.exit(1);
    }

    // Validate JWT_SECRET length
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.error('❌ JWT_SECRET is too short. It should be at least 32 characters long.');
        process.exit(1);
    }

    console.log('✅ Environment variables validated successfully');
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const fromName = process.env.RESEND_FROM_NAME || 'Quiz System';
    console.log(`📧 Email config: ${fromName} <${fromEmail}>`);
};
