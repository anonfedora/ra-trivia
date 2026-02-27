import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from 'database';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middlewares/errorHandler';
import { sendVerificationEmail } from '../services/email';
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
        .isIn(['ADMIN', 'CANDIDATE'])
        .withMessage('Role must be either ADMIN or CANDIDATE')
];

// Login validation rules
const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
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
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Hash password with higher cost factor for better security
        const hashedPassword = await bcrypt.hash(password, 12);

        const rawVerifyToken = crypto.randomBytes(32).toString('hex');
        const verifyTokenHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
        const verifyTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
        
        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                church: church || null,
                role: role || 'CANDIDATE',
                emailVerified: true, // TODO: Change back to false when email verification is re-enabled
                emailVerificationTokenHash: verifyTokenHash,
                emailVerificationTokenExpiresAt: verifyTokenExpiresAt
            }
        });

        const protocol = (req.header('x-forwarded-proto') || req.protocol || 'http').toString();
        const host = (req.header('x-forwarded-host') || req.get('host') || 'localhost:4000').toString();
        const verifyUrl = `${protocol}://${host}/api/auth/verify?token=${rawVerifyToken}`;
        
        // TODO: Re-enable email verification later
        // const emailSent = await sendVerificationEmail(user.email, user.name, verifyUrl);
        const emailSent = true; // Temporarily bypass email sending

        res.status(201).json({
            message: 'Registration successful! You can now log in.', // TODO: Revert to email verification message when re-enabled
            emailSent,
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

router.post('/resend-verification', [
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

        await sendVerificationEmail(user.email, user.name, verifyUrl);
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
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
