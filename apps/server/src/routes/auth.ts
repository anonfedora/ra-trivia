import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from 'database';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middlewares/errorHandler';
import { sendVerificationEmail, generateOTP, sendPasswordResetEmail } from '../services/email';
import { authenticate, AuthRequest } from '../middlewares/auth';
import {
    passwordValidation,
    emailValidation,
    nameValidation
} from '../utils/validation';
import { emitNotification } from '../services/socketService';

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
        .withMessage('Role must be either SUPER_ADMIN, ADMIN, or CANDIDATE'),
    body('userType')
        .custom((value, { req }) => {
            // Only require userType for candidates
            if (req.body.role === 'CANDIDATE' || !req.body.role) {
                if (!value) {
                    throw new Error('User type is required for candidates');
                }
                if (!['AMBASSADOR_RANK_EXAMS', 'EXTRAORDINARY_RANK_EXAMS', 'PRE_PLENIPOTENTIARY_EXAMS', 'PLENIPOTENTIARY_RANK_EXAMS'].includes(value)) {
                    throw new Error('User type must be one of: Ambassador Rank Exams, Extraordinary Rank Exams, Pre-Plenipotentiary Exams, or Plenipotentiary Rank Exams');
                }
            }
            return true;
        })
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
        const { email, name, password, church, association, role, userType } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            if (!existingUser.emailVerified) {
                // Also trigger a new OTP here for consistency
                const otp = generateOTP();
                const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
                const otpExpiresAt = new Date(Date.now() + 1000 * 60 * 10);

                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        emailOtpHash: otpHash,
                        emailOtpExpiresAt: otpExpiresAt
                    }
                });

                const protocol = (req.header('x-forwarded-proto') || req.protocol || 'http').toString();
                const host = (req.header('x-forwarded-host') || req.get('host') || 'localhost:4000').toString();
                const frontendUrl = WEB_URL || `${protocol}://${host.replace('4000', '3000')}`;
                const verifyUrl = `${frontendUrl}/verify-otp?email=${encodeURIComponent(existingUser.email)}`;

                sendVerificationEmail(existingUser.email, existingUser.name, verifyUrl, otp)
                    .catch(err => console.error('[AUTH] Register-triggered verification email failed:', err));

                return res.status(200).json({
                    message: 'An unverified account already exists. A new verification code has been sent. Redirecting...',
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
                association: association || null,
                role: role || 'CANDIDATE',
                userType: userType || 'AMBASSADOR_RANK_EXAMS', // Default for admins or if not provided
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
                userType: user.userType,
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
            // Automatically trigger a new OTP if unverified user tries to log in
            const otp = generateOTP();
            const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
            const otpExpiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

            console.log(`[AUTH] Login redirect: Generating new OTP for ${user.email}: ${otp} (Hash: ${otpHash.substring(0, 10)}...)`);

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    emailOtpHash: otpHash,
                    emailOtpExpiresAt: otpExpiresAt
                }
            });

            const protocol = (req.header('x-forwarded-proto') || req.protocol || 'http').toString();
            const host = (req.header('x-forwarded-host') || req.get('host') || 'localhost:4000').toString();
            // Use WEB_URL if available for more reliable frontend links
            const frontendUrl = WEB_URL || `${protocol}://${host.replace('4000', '3000')}`;
            const verifyUrl = `${frontendUrl}/verify-otp?email=${encodeURIComponent(user.email)}`;

            // Send verification email in the background
            sendVerificationEmail(user.email, user.name, verifyUrl, otp)
                .catch(err => console.error('[AUTH] Login-triggered verification email failed:', err));

            return res.status(403).json({
                message: 'Please verify your email before logging in. A new verification code has been sent to your email.',
                isUnverified: true,
                email: user.email
            });
        }

        const token = jwt.sign({ userId: user.id, role: user.role, userType: user.userType }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                userType: user.userType,
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
        const isHashMatch = user.emailOtpHash === otpHash;
        const isExpired = !user.emailOtpExpiresAt || user.emailOtpExpiresAt <= new Date();

        console.log(`[AUTH] OTP Verify for ${email}: Input=${otp} (Hash: ${otpHash.substring(0, 10)}...), DB Hash: ${user.emailOtpHash?.substring(0, 10)}..., Match: ${isHashMatch}, Expired: ${isExpired}`);

        if (!isHashMatch || isExpired) {
            const errorMsg = !isHashMatch ? 'Invalid verification code' : 'Verification code has expired';
            return res.status(400).json({ message: errorMsg });
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

        // Notify all SUPER_ADMINs when any new account is verified
        const superAdmins = await prisma.user.findMany({
            where: { role: 'SUPER_ADMIN', emailVerified: true },
            select: { id: true }
        });
        if (superAdmins.length > 0) {
            const isAdminRole = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
            const roleLabel = user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role === 'ADMIN' ? 'Admin' : 'Candidate';
            const notifType = isAdminRole ? 'NEW_ADMIN_REGISTERED' : 'NEW_USER_REGISTERED';
            const notifData = superAdmins.map(sa => ({
                type: notifType,
                title: `New ${roleLabel} Registered`,
                message: `${user.name} (${user.email}) has verified their account and joined as ${roleLabel}.`,
                candidateName: user.name,
                candidateEmail: user.email,
                isRead: false,
                createdById: sa.id,
            }));
            await prisma.notification.createMany({ data: notifData });
            for (const notif of notifData) {
                emitNotification(notif.createdById, { ...notif, createdAt: new Date().toISOString() });
            }
        }

        const token = jwt.sign({ userId: user.id, role: user.role, userType: user.userType }, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            message: 'Email verified successfully!',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                userType: user.userType,
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

// Get user profile endpoint
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                userType: true,
                church: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('[AUTH] Get profile error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update user profile endpoint
router.put('/profile', authenticate, [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Name must be between 1 and 100 characters'),
    body('church')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Church name must not exceed 200 characters'),
    body('association')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Association name must not exceed 200 characters'),
    body('userType')
        .optional()
        .isIn(['AMBASSADOR_RANK_EXAMS', 'EXTRAORDINARY_RANK_EXAMS', 'PRE_PLENIPOTENTIARY_EXAMS', 'PLENIPOTENTIARY_RANK_EXAMS'])
        .withMessage('User type must be one of: Ambassador Rank Exams, Extraordinary Rank Exams, Pre-Plenipotentiary Exams, or Plenipotentiary Rank Exams')
], handleValidationErrors, async (req: AuthRequest, res: Response) => {
    try {
        const { name, church, association, userType } = req.body;
        const userId = req.user!.userId;

        // Get current user data for audit logging
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { userType: true }
        });

        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Build update data object with only provided fields
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (church !== undefined) updateData.church = church || null;
        if (association !== undefined) updateData.association = association || null;
        if (userType !== undefined) updateData.userType = userType;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                userType: true,
                church: true,
                association: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true
            }
        });

        // Create audit log entry if userType was changed
        // TODO: Temporarily commented out due to Prisma client generation issue with UserTypeAuditLog model
        // if (userType !== undefined && userType !== currentUser.userType) {
        //     await prisma.userTypeAuditLog.create({
        //         data: {
        //             userId: userId,
        //             previousType: currentUser.userType,
        //             newType: userType,
        //             ipAddress: req.ip || (req as any).connection?.remoteAddress || null,
        //             userAgent: req.get('User-Agent') || null
        //         }
        //     });
        // }

        // If userType was updated, generate a new JWT token with the updated userType
        let newToken = null;
        if (userType !== undefined) {
            newToken = jwt.sign({ 
                userId: updatedUser.id, 
                role: updatedUser.role, 
                userType: updatedUser.userType 
            }, JWT_SECRET, { expiresIn: '24h' });
        }

        res.json({
            message: 'Profile updated successfully',
            user: updatedUser,
            ...(newToken && { token: newToken })
        });
    } catch (error) {
        console.error('[AUTH] Update profile error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Forgot password — send reset link
router.post('/forgot-password', [
    body('email').isEmail().withMessage('Please provide a valid email address').trim()
], handleValidationErrors, async (req: Request, res: Response) => {
    try {
        const { email } = req.body as { email: string };
        const user = await prisma.user.findUnique({ where: { email } });

        // Always return the same message to prevent user enumeration
        const genericMsg = 'If an account exists for this email, a password reset link has been sent.';

        if (!user || !user.emailVerified) {
            return res.json({ message: genericMsg });
        }

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetTokenHash: tokenHash,
                passwordResetTokenExpiresAt: expiresAt
            }
        });

        const resetUrl = `${WEB_URL}/reset-password?token=${rawToken}`;
        sendPasswordResetEmail(user.email, user.name, resetUrl)
            .catch(err => console.error('[AUTH] Password reset email failed:', err));

        return res.json({ message: genericMsg });
    } catch (error) {
        console.error('[AUTH] Forgot password error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// Reset password — consume token and set new password
router.post('/reset-password', [
    body('token').notEmpty().withMessage('Reset token is required'),
    passwordValidation()
], handleValidationErrors, async (req: Request, res: Response) => {
    try {
        const { token, password } = req.body as { token: string; password: string };

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const user = await prisma.user.findFirst({
            where: {
                passwordResetTokenHash: tokenHash,
                passwordResetTokenExpiresAt: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetTokenHash: null,
                passwordResetTokenExpiresAt: null
            }
        });

        return res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        console.error('[AUTH] Reset password error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
