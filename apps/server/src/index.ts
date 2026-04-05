import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { validateEnv } from './utils/envValidator';
import { apiLimiter, authLimiter } from './middlewares/rateLimiter';
import { globalErrorHandler } from './middlewares/errorHandler';
import { sanitizeInput } from './middlewares/sanitize';
import authRoutes from './routes/auth';
import questionRoutes from './routes/questions';
import quizRoutes from './routes/quiz';
import adminRoutes from './routes/admin';
import quizzesRoutes from './routes/quizzes';
import notificationRoutes from './routes/notifications';
import supportRoutes from './routes/support';
import healthRoutes from './routes/health';
import passwordRequirementsRoutes from './routes/password-requirements';
import { initScheduler } from './services/scheduler';
import { initSocketIO } from './services/socketService';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

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
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Trust proxy for Render deployment (only trust Render's proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet()); // Set security headers

// Configure CORS to allow multiple origins
const allowedOrigins = [
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
    'http://localhost:3000',
    'http://localhost:8081',
    'http://10.113.159.193:8081',
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
            res.header(
                'Access-Control-Allow-Headers',
                (typeof requestedHeaders === 'string' && requestedHeaders.length > 0)
                    ? requestedHeaders
                    : 'Content-Type, Authorization, cache-control, x-requested-with'
            );
            res.header('Access-Control-Allow-Credentials', 'true');
            return res.status(204).send();
        } else {
            return res.status(403).send('CORS policy violation');
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

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // Alias

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/password-requirements', passwordRequirementsRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(globalErrorHandler);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});
initSocketIO(io);

httpServer.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Initialize scheduled tasks
    initScheduler();
});
