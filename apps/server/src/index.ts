import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { validateEnv } from './utils/envValidator';
import { apiLimiter, authLimiter } from './middlewares/rateLimiter';
import { globalErrorHandler } from './middlewares/errorHandler';
import { sanitizeInput } from './middlewares/sanitize';
import authRoutes from './routes/auth';
import questionRoutes from './routes/questions';
import quizRoutes from './routes/quiz';
import adminRoutes from './routes/admin';
import quizzesRoutes from './routes/quizzes';
import passwordRequirementsRoutes from './routes/password-requirements';
import { initScheduler } from './services/scheduler';

// Validate environment variables on startup
validateEnv();

// Test database connection
import { prisma } from 'database';

async function testDatabaseConnection() {
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

testDatabaseConnection();

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy for Render deployment (only trust Render's proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet()); // Set security headers

// Configure CORS to allow multiple origins
const allowedOrigins = [
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
    'http://localhost:3000',
    'https://ra-trivia.vercel.app',
    'https://ra-trivia.onrender.com'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'cache-control'],
    preflightContinue: false,
    optionsSuccessStatus: 204
})); // Configure CORS properly

// Handle preflight requests for all routes
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        const requestedHeaders = req.headers['access-control-request-headers'];
        if (allowedOrigins.includes(origin as string) || !origin) {
            res.header('Access-Control-Allow-Origin', origin || '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            // Important: include any headers the browser requests (e.g. cache-control)
            res.header(
                'Access-Control-Allow-Headers',
                (typeof requestedHeaders === 'string' && requestedHeaders.length > 0)
                    ? requestedHeaders
                    : 'Content-Type, Authorization, cache-control'
            );
            res.header('Access-Control-Allow-Credentials', 'true');
            res.status(204).send();
        } else {
            res.status(403).send('CORS policy violation');
        }
    } else {
        next();
    }
});
app.use(express.json({ limit: '10mb' })); // Limit body size
app.use(sanitizeInput); // Prevent XSS attacks with custom sanitization

// Apply rate limiting
app.use('/api/', apiLimiter); // General API rate limit
app.use('/api/auth/', authLimiter); // Strict rate limit for auth endpoints

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/password', passwordRequirementsRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quizzes', quizzesRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(globalErrorHandler);

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Initialize scheduled tasks
    initScheduler();
});
