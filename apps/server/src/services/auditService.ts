import { prisma } from 'database';
import { Request } from 'express';
import { getClientIp } from '../utils/ip';

export interface AuditLogData {
  action: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Service to handle system auditing and logging
 */
export const auditService = {
  /**
   * Log a general system event
   */
  async log(data: AuditLogData) {
    try {
      return await prisma.auditLog.create({
        data: {
          action: data.action,
          userId: data.userId || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          metadata: data.metadata || {},
        },
      });
    } catch (error) {
      console.error('[AUDIT_SERVICE] Failed to create audit log:', error);
      // We don't throw here to avoid breaking the main request flow
      return null;
    }
  },

  /**
   * Log an event from an Express Request object
   */
  async logFromRequest(req: Request, action: string, userId?: string, metadata?: Record<string, any>) {
    return this.log({
      action,
      userId: userId || (req as any).user?.userId,
      ipAddress: getClientIp(req),
      userAgent: req.get('User-Agent'),
      metadata,
    });
  },

  /**
   * Specialized logger for administrative logins
   */
  async logAdminLogin(req: Request, user: { id: string; email: string; role: string }) {
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      return this.logFromRequest(req, 'ADMIN_LOGIN', user.id, {
        email: user.email,
        role: user.role,
      });
    }
    return null;
  },

  /**
   * Specialized logger for exam lifecycle events
   */
  async logExamEvent(req: Request, action: 'EXAM_STARTED' | 'EXAM_SUBMITTED' | 'EXAM_TERMINATED', sessionId: string, quizId: string) {
    return this.logFromRequest(req, action, undefined, {
      sessionId,
      quizId,
    });
  }
};
