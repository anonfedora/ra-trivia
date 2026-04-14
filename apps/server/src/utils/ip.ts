import { Request } from 'express';

/**
 * Extract the client's IP address from an Express request object.
 * Handles proxy headers if 'trust proxy' is enabled.
 */
export const getClientIp = (req: Request): string => {
  // If 'trust proxy' is set in express (done in index.ts), req.ip will contain the real client IP
  // Otherwise, fallback to various headers or remoteAddress
  const ip = req.ip || 
             req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || 
             req.socket.remoteAddress || 
             'unknown';
  
  // Clean up IPv6-mapped IPv4 addresses (e.g., ::ffff:127.0.0.1)
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
};
