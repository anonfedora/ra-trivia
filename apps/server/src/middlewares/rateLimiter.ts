import rateLimit from 'express-rate-limit';

/**
 * Skip preflight (OPTIONS) requests. 
 * Browsers send an OPTIONS request before any non-simple request (like those with Authorization header).
 * These should not count toward the rate limit.
 */
const skipPreflight = (req: any) => req.method === 'OPTIONS';

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Increased to 300 to accommodate modern SPA usage (many small fetches on mount)
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipPreflight,
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Increased to 20 for better DX (5 was too low given retries/refreshes)
    message: 'Too many authentication attempts, please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    skip: skipPreflight,
});

// Rate limiter for quiz submission
export const quizSubmitLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit to 10 submissions per minute
    message: 'Too many quiz submissions, please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipPreflight,
});
