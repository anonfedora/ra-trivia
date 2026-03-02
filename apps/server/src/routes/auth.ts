import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from 'database';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middlewares/errorHandler';
import { sendVerificationEmail, generateOTP } from '../services/email';
import { authenticate, AuthRequest } from '../middlewares/auth';
import {
    passwordValidation,
    emailValidation,
    nameValidation
} from '../utils/validation';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!; // Will be validated on startup
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

// Registration validation rules
const registerValidation = [
    emailValidation(),
    nameValidation(),
    passwordValidation(),
    body('church')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Church name must not exceed 200 characters')
        .escape(),
    body('role')
        .optional()
        .isIn(['SUPER_ADMIN', 'ADMIN', 'CANDIDATE'])
        .withMessage('Role must be either SUPER_ADMIN, ADMIN, or CANDIDATE')
];

// Login validation rules
const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .trim(), // Only trim whitespace, don't normalize
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

router.post('/register', registerValidation, handleValidationErrors, async (req: Request, res: Response) => {
    try {
        const { email, name, password, church, role } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            if (!existingUser.emailVerified) {
                return res.status(200).json({
                    message: 'An unverified account already exists. Redirecting to verification page...',
                    isUnverified: true,
                    email: existingUser.email
                });
            }
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Hash password with higher cost factor for better security
        const hashedPassword = await bcrypt.hash(password, 12);

        const rawVerifyToken = crypto.randomBytes(32).toString('hex');
        const verifyTokenHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
        const verifyTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

        // Generate 6-digit OTP for email verification
        const otp = generateOTP();
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        const otpExpiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                church: church || null,
                role: role || 'CANDIDATE',
                emailVerified: false, // Require OTP verification
                emailVerificationTokenHash: verifyTokenHash,
                emailVerificationTokenExpiresAt: verifyTokenExpiresAt,
                emailOtpHash: otpHash,
                emailOtpExpiresAt: otpExpiresAt
            }
        });

        const protocol = (req.header('x-forwarded-proto') || req.protocol || 'http').toString();
        const host = (req.header('x-forwarded-host') || req.get('host') || 'localhost:4000').toString();
        const verifyUrl = `${protocol}://${host}/api/auth/verify?token=${rawVerifyToken}`;

        // Send verification email with OTP in the background to avoid latency
        sendVerificationEmail(user.email, user.name, verifyUrl, otp)
            .catch(err => console.error('[AUTH] Background verification email failed:', err));

        res.status(201).json({
            message: 'Registration successful! Please check your email for a 6-digit verification code.',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                emailVerified: user.emailVerified
            }
        });
    } catch (error) {
        console.error('Registration error:', error);

        // Log more detailed error information
        if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }

        // Check for specific database connection errors
        if (error && typeof error === 'object' && 'code' in error) {
            console.error('Database error code:', (error as any).code);
        }

        res.status(500).json({
            message: 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && {
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        });
    }
});

router.post('/resend-verification-link', [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail()
], handleValidationErrors, async (req: Request, res: Response) => {
    try {
        const { email } = req.body as { email: string };

        const user = await prisma.user.findUnique({ where: { email } });

        // Prevent user enumeration
        if (!user || user.emailVerified) {
            return res.json({ message: 'If an account exists for this email, a verification email has been sent.' });
        }

        const rawVerifyToken = crypto.randomBytes(32).toString('hex');
        const verifyTokenHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
        const verifyTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerificationTokenHash: verifyTokenHash,
                emailVerificationTokenExpiresAt: verifyTokenExpiresAt
            }
        });

        const protocol = (req.header('x-forwarded-proto') || req.protocol || 'http').toString();
        const host = (req.header('x-forwarded-host') || req.get('host') || 'localhost:4000').toString();
        const verifyUrl = `${protocol}://${host}/api/auth/verify?token=${rawVerifyToken}`;

        sendVerificationEmail(user.email, user.name, verifyUrl)
            .catch(err => console.error('[AUTH] Background resend verification failed:', err));

        return res.json({ message: 'If an account exists for this email, a verification email has been sent.' });
    } catch (error) {
        console.error('Resend verification error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/verify', async (req: Request, res: Response) => {
    try {
        const token = (req.query.token as string | undefined) || '';
        if (!token) {
            return res.redirect(`${WEB_URL}/login?verified=0`);
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const user = await prisma.user.findFirst({
            where: {
                emailVerificationTokenHash: tokenHash,
                emailVerificationTokenExpiresAt: { gt: new Date() }
            }
        });

        if (!user) {
            return res.redirect(`${WEB_URL}/login?verified=0`);
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                emailVerificationTokenHash: null,
                emailVerificationTokenExpiresAt: null
            }
        });

        return res.redirect(`${WEB_URL}/login?verified=1`);
    } catch (error) {
        console.error('Verify email error:', error);
        return res.redirect(`${WEB_URL}/login?verified=0`);
    }
});

router.post('/login', loginValidation, handleValidationErrors, async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            // Use generic message to prevent user enumeration
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (!user.emailVerified) {
            return res.status(403).json({ message: 'Please verify your email before logging in.' });
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                emailVerified: user.emailVerified
            }
        });
    } catch (error) {
        console.error('[AUTH] Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// OTP verification endpoint
router.post('/verify-otp', [
    body('email').isEmail().withMessage('Please provide a valid email address'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], handleValidationErrors, async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if OTP is valid and not expired
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        const isOtpValid = user.emailOtpHash === otpHash && user.emailOtpExpiresAt && user.emailOtpExpiresAt > new Date();

        if (!isOtpValid) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Mark email as verified and clear OTP
        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                emailOtpHash: null,
                emailOtpExpiresAt: null
            }
        });

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            message: 'Email verified successfully!',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                emailVerified: true
            }
        });
    } catch (error) {
        console.error('[AUTH] OTP verification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout endpoint
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        // In a real app, you might want to blacklist the token
        // For now, we'll just return a success message
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('[AUTH] Logout error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Resend OTP endpoint
router.post('/resend-verification', [
    body('email').isEmail().withMessage('Please provide a valid email address')
], handleValidationErrors, async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });

        // Prevent user enumeration
        if (!user || user.emailVerified) {
            return res.json({ message: 'If an account exists for this email, a verification code has been sent.' });
        }

        // Generate new OTP
        const otp = generateOTP();
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        const otpExpiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailOtpHash: otpHash,
                emailOtpExpiresAt: otpExpiresAt
            }
        });

        const protocol = (req.header('x-forwarded-proto') || req.protocol || 'http').toString();
        const host = (req.header('x-forwarded-host') || req.get('host') || 'localhost:4000').toString();
        const verifyUrl = `${protocol}://${host}/verify-otp?email=${encodeURIComponent(email)}`;

        // Send verification email with new OTP
        const emailSent = await sendVerificationEmail(user.email, user.name, verifyUrl, otp);

        res.json({
            message: 'Verification code sent successfully!',
            emailSent
        });
    } catch (error) {
        console.error('[AUTH] Resend OTP error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
