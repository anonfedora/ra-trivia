import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from 'database';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middlewares/errorHandler';
import { sendVerificationEmail, generateOTP, sendPasswordResetEmail } from '../services/email';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { generateTokenPair, verifyRefreshToken, blacklistToken, rotateRefreshToken, revokeAllRefreshTokens, generateAccessToken } from '../services/tokenService';
import {
    passwordValidation,
    emailValidation,
    nameValidation
} from '../utils/validation';
import { emitNotification } from '../services/socketService';

const router = Router();
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

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: Create a new account. Candidates require a userType. Registration triggers a 6-digit OTP email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *                 minLength: 1
 *               password:
 *                 type: string
 *                 minLength: 8
 *               church:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [CANDIDATE, ADMIN, SUPER_ADMIN]
 *                 default: CANDIDATE
 *               userType:
 *                 type: string
 *                 enum: [AMBASSADOR_RANK_EXAMS, EXTRAORDINARY_RANK_EXAMS, PRE_PLENIPOTENTIARY_EXAMS, PLENIPOTENTIARY_RANK_EXAMS]
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: User already exists or validation error
 *       500:
 *         description: Internal server error
 */
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ message: 'Internal server error', error: errorMessage });
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

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in to the application
 *     description: Authenticate with email and password to receive access and refresh tokens.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified (triggers new OTP)
 *       500:
 *         description: Internal server error
 */
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

        // Generate token pair (access + refresh)
        const tokens = await generateTokenPair({ 
            userId: user.id, 
            role: user.role, 
            userType: user.userType 
        });
        
        res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Internal server error', error: errorMessage });
    }
});

// OTP verification endpoint
/**
 * @openapi
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email with 6-digit OTP
 *     description: Completes the registration or verification process using the code sent to the user's email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired code
 *       404:
 *         description: User not found
 */
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

        // Generate token pair for verified user
        const tokens = await generateTokenPair({ 
            userId: user.id, 
            role: user.role, 
            userType: user.userType 
        });

        res.json({
            message: 'Email verified successfully!',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Internal server error', error: errorMessage });
    }
});

// Logout endpoint
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const { refreshToken } = req.body;

        // Blacklist access token
        if (token) {
            await blacklistToken(token);
        }

        // Revoke refresh token if provided
        if (refreshToken) {
            await prisma.refreshToken.delete({
                where: { 
                    token: refreshToken,
                    userId: req.user!.userId 
                }
            }).catch(() => {
                // Silently fail if token already gone
                console.log(`[AUTH] Refresh token already removed or invalid during logout`);
            });
        }

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('[AUTH] Logout error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Internal server error', error: errorMessage });
    }
});

// Refresh token endpoint
/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: Rotates the refresh token and returns a new access token. Transparent session maintenance.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh-token', [
    body('refreshToken').notEmpty().withMessage('Refresh token is required')
], handleValidationErrors, async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        // 1. Verify and Rotate the refresh token
        // rotateRefreshToken handles verification, deletion of old, and creation of new
        const newRefreshToken = await rotateRefreshToken(refreshToken);

        // 2. Get user info to generate new access token
        // We know the rotation was successful, let's get the user ID from the new token
        // (Or we can modify rotateRefreshToken to return info, but for now we'll just re-check or use separate logic)
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: newRefreshToken },
            include: { user: true }
        });

        if (!storedToken) {
            throw new Error('Rotation succeeded but token missing');
        }

        const accessToken = generateAccessToken({ 
            userId: storedToken.userId, 
            role: storedToken.user.role, 
            userType: storedToken.user.userType 
        });

        res.json({
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error: any) {
        console.error('[AUTH] Refresh token error:', error.message);
        res.status(401).json({ message: error.message || 'Invalid or expired refresh token' });
    }
});

// Logout from all devices
router.post('/logout-all', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        // Blacklist current access token
        if (token) {
            await blacklistToken(token);
        }

        // Revoke all refresh tokens for this user
        await revokeAllRefreshTokens(req.user!.userId);

        res.json({ message: 'Logged out from all devices successfully' });
    } catch (error) {
        console.error('[AUTH] Logout all error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Internal server error', error: errorMessage });
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Internal server error', error: errorMessage });
    }
});

// Get user profile endpoint
/**
 * @openapi
 * /auth/profile:
 *   get:
 *     tags: [Profile]
 *     summary: Get current user profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Internal server error', error: errorMessage });
    }
});

// Update user profile endpoint
/**
 * @openapi
 * /auth/profile:
 *   put:
 *     tags: [Profile]
 *     summary: Update user profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               church:
 *                 type: string
 *               association:
 *                 type: string
 *               userType:
 *                 type: string
 *                 enum: [AMBASSADOR_RANK_EXAMS, EXTRAORDINARY_RANK_EXAMS, PRE_PLENIPOTENTIARY_EXAMS, PLENIPOTENTIARY_RANK_EXAMS]
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
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

        // If userType was updated, generate new token pair with the updated userType
        let newTokens = null;
        if (userType !== undefined) {
            newTokens = await generateTokenPair({ 
                userId: updatedUser.id, 
                role: updatedUser.role, 
                userType: updatedUser.userType 
            });
        }

        res.json({
            message: 'Profile updated successfully',
            user: updatedUser,
            ...(newTokens && { 
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken 
            })
        });
    } catch (error) {
        console.error('[AUTH] Update profile error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Internal server error', error: errorMessage });
    }
});

// Forgot password — send reset link
/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     description: Sends a password reset link to the user's email if the account is verified.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset email sent (or generic success message)
 */
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ message: 'Internal server error', error: errorMessage });
    }
});

// Reset password — consume token and set new password
/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 *     description: Consumes a password reset token and sets a new password for the user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ message: 'Internal server error', error: errorMessage });
    }
});

export default router;
