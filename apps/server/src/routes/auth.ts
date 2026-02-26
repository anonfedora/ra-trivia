import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from 'database';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middlewares/errorHandler';
import { 
    passwordValidation, 
    emailValidation, 
    nameValidation 
} from '../utils/validation';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!; // Will be validated on startup

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
        
        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                church: church || null,
                role: role || 'CANDIDATE'
            }
        });

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ 
            token, 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                role: user.role 
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

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                role: user.role 
            } 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
