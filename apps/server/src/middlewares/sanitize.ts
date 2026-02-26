import { Request, Response, NextFunction } from 'express';

/**
 * Custom XSS sanitization middleware compatible with Express 5
 * Sanitizes request body only (query and params are read-only in Express 5)
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Only sanitize body (query and params are read-only in Express 5)
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeObject(req.body);
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }

    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    return obj;
}

/**
 * Sanitize a string by removing potentially dangerous characters
 */
function sanitizeString(str: string): string {
    if (typeof str !== 'string') {
        return str;
    }

    // Remove common XSS patterns
    return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '') // Remove embed tags
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, ''); // Remove object tags
}
