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

// Validate environment variables on startup
validateEnv();

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet()); // Set security headers
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
})); // Configure CORS properly
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
});
