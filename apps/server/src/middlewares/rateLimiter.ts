import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Skip preflight (OPTIONS) requests. 
 * Browsers send an OPTIONS request before any non-simple request (like those with Authorization header).
 * These should not count toward the rate limit.
 */
const skipPreflight = (req: any) => req.method === 'OPTIONS';

// General API rate limiter (fallback for unauthenticated requests)
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased significantly for concurrent users
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Skip for preflight requests or authenticated requests
    skip: (req: any) => req.method === 'OPTIONS' || !!req.user?.userId,
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Increased for better UX during bulk registration
    message: 'Too many authentication attempts, please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req: any) => req.method === 'OPTIONS',
});

// Registration-specific rate limiter (more lenient for bulk registration)
export const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Allow more registration attempts
    message: 'Too many registration attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: any) => req.method === 'OPTIONS',
    keyGenerator: (req: any) => ipKeyGenerator(req), // Use proper IPv6-compatible IP key generator
});

// Quiz operations rate limiter (for active quiz sessions)
export const quizLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 800, // Higher limit for quiz operations
    message: 'Too many quiz requests, please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: any) => req.method === 'OPTIONS',
    keyGenerator: (req: any) => req.user?.userId || ipKeyGenerator(req), // Rate limit by user when possible, fallback to IP
});

// NOTE: Quiz submission rate limiting removed - business logic already prevents duplicate submissions
// Each session can only be submitted once (endTime check), making rate limiting unnecessary
// This prevents 429 errors during legitimate concurrent exam scenarios
