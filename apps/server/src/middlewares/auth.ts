import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, isTokenBlacklisted, TokenPayload } from '../services/tokenService';

export interface AuthRequest extends Request {
    user?: TokenPayload;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        // Check if token is blacklisted
        const blacklisted = await isTokenBlacklisted(token);
        if (blacklisted) {
            return res.status(401).json({ message: 'Token has been revoked' });
        }

        // Verify access token
        const decoded = verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

export const authorize = (roles: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        // First authenticate
        await authenticate(req, res, () => {
            if (!req.user || !roles.includes(req.user.role)) {
                return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
            }
            next();
        });
    };
};

export const authorizeAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // First authenticate
    await authenticate(req, res, () => {
        if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Forbidden: Admin access required' });
        }
        next();
    });
};

export const authorizeSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // First authenticate
    await authenticate(req, res, () => {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Forbidden: Super admin access required' });
        }
        next();
    });
};
