import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// Validation error handler middleware
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorArray = errors.array();
        
        // Create a more descriptive message
        const firstError = errorArray[0];
        const mainMessage = errorArray.length === 1 
            ? firstError.msg 
            : `${errorArray.length} validation errors occurred`;
        
        return res.status(400).json({
            message: mainMessage,
            errors: errorArray.map(err => ({
                field: err.type === 'field' ? err.path : undefined,
                message: err.msg
            }))
        });
    }
    next();
};

// Global error handler
export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
    });
};
