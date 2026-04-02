import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from 'database';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined');
}

export interface TokenPayload {
  userId: string;
  role: string;
  userType: string;
  jti?: string; // JWT ID for specific tracking
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate access token (short-lived: 15 minutes)
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { 
    expiresIn: '15m',
    issuer: 'ra-trivia',
    audience: 'ra-trivia-users'
  });
};

/**
 * Generate refresh token (long-lived: 7 days)
 */
export const generateRefreshToken = async (userId: string): Promise<string> => {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Store refresh token in database
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt
    }
  });

  return token;
};

/**
 * Generate token pair
 */
export const generateTokenPair = async (payload: TokenPayload): Promise<TokenPair> => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(payload.userId);

  return { accessToken, refreshToken };
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'ra-trivia',
      audience: 'ra-trivia-users'
    }) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token expired');
    }
    throw new Error('Invalid access token');
  }
};

/**
 * Verify refresh token and return user info
 */
export const verifyRefreshToken = async (token: string): Promise<{ userId: string; role: string; userType: string }> => {
  // Check if token exists in database and is not expired
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!storedToken) {
    throw new Error('Refresh token not found or already used');
  }

  if (storedToken.expiresAt <= new Date()) {
    // Clean up expired token
    await prisma.refreshToken.delete({ where: { token } }).catch(() => {});
    throw new Error('Refresh token expired');
  }

  return {
    userId: storedToken.userId,
    role: storedToken.user.role,
    userType: storedToken.user.userType
  };
};

/**
 * Blacklist a token (for logout)
 */
export const blacklistToken = async (token: string): Promise<void> => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return;

    const expiresAt = new Date(decoded.exp * 1000);

    // Only blacklist if not already expired
    if (expiresAt > new Date()) {
      await prisma.blacklistedToken.upsert({
        where: { token },
        create: { token, expiresAt },
        update: { expiresAt }
      });
    }
  } catch (error) {
    console.error('Error blacklisting token:', error);
  }
};

/**
 * Check if token is blacklisted
 */
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const blacklisted = await prisma.blacklistedToken.findUnique({
      where: { token }
    });

    if (!blacklisted) return false;

    // Clean up if actually expired
    if (blacklisted.expiresAt <= new Date()) {
      await prisma.blacklistedToken.delete({ where: { token } }).catch(() => {});
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking blacklist:', error);
    return false;
  }
};

/**
 * Revoke all refresh tokens for a user
 */
export const revokeAllRefreshTokens = async (userId: string): Promise<void> => {
  await prisma.refreshToken.deleteMany({
    where: { userId }
  });
};

/**
 * Clean up expired tokens (can be called by a scheduler)
 */
export const cleanupExpiredTokens = async (): Promise<void> => {
  try {
    const now = new Date();
    await Promise.all([
      prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.blacklistedToken.deleteMany({ where: { expiresAt: { lt: now } } })
    ]);
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
  }
};

/**
 * Rotate refresh token (issue new one and invalidate old)
 * Standard Refresh Token Rotation with basic reuse detection
 */
export const rotateRefreshToken = async (oldToken: string): Promise<string> => {
  try {
    // 1. Verify old token exists and is valid
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: oldToken }
    });

    if (!storedToken) {
      // REUSE DETECTION: If a token is presented that DOES NOT exist in the DB,
      // it might have been stolen and already rotated. 
      // Most secure approach: Revoke all sessions for the suspected user.
      // For now, we'll just throw, but a production system might want more aggressive revocation.
      throw new Error('Refresh token reuse detected or invalid token');
    }

    const userId = storedToken.userId;

    // 2. Perform rotation in a transaction to ensure atomicity
    return await prisma.$transaction(async (tx) => {
      // Delete the old token
      await tx.refreshToken.delete({
        where: { token: oldToken }
      });

      // Generate and store new token
      const newToken = crypto.randomBytes(64).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await tx.refreshToken.create({
        data: {
          token: newToken,
          userId,
          expiresAt
        }
      });

      return newToken;
    });
  } catch (error) {
    console.error('Token rotation failed:', error);
    throw new Error('Token rotation failed');
  }
};

