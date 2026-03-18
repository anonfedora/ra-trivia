import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, authorizeAdmin, AuthRequest } from '../middlewares/auth';

const router = Router();

// Get notifications for the logged-in user (any role)
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.userId;
        const userRole = req.user?.role;
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
        const unreadOnly = req.query.unreadOnly === 'true';

        const where: any = {};

        // Candidate-only notification types — never shown to admins
        const CANDIDATE_TYPES = ['NEW_EXAM_AVAILABLE', 'RESULT_RELEASED'];
        // Admin-only notification types — never shown to candidates
        const ADMIN_TYPES = ['EXAM_SUBMITTED', 'NEW_USER_REGISTERED', 'NEW_ADMIN_REGISTERED'];

        if (userRole === 'SUPER_ADMIN') {
            // SUPER_ADMIN only sees admin-relevant notifications, not candidate-scoped ones
            where.type = { in: ADMIN_TYPES };
        } else if (userRole === 'ADMIN') {
            // Regular admins see only their own admin notifications
            where.createdById = userId;
            where.type = { in: ADMIN_TYPES };
        } else {
            // Candidates see only their own candidate notifications
            where.createdById = userId;
            where.type = { in: CANDIDATE_TYPES };
        }

        if (unreadOnly) {
            where.isRead = false;
        }

        const [total, notifications] = await prisma.$transaction([
            prisma.notification.count({ where }),
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize
            })
        ]);

        const unreadCount = await prisma.notification.count({
            where: { ...where, isRead: false }
        });

        res.json({ notifications, total, unreadCount, page, pageSize });
    } catch (error) {
        console.error('Fetch notifications error:', error);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
});

// Mark notification as read (any authenticated user, own notifications only)
router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
    try {
        const notificationId = req.params.id as string;
        const userId = req.user?.userId;
        const userRole = req.user?.role;

        const notification = await prisma.notification.findUnique({
            where: { id: notificationId }
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (userRole !== 'SUPER_ADMIN' && notification.createdById !== userId) {
            return res.status(403).json({ message: 'You do not have permission to mark this notification' });
        }

        const updated = await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        });

        res.json(updated);
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ message: 'Failed to mark notification as read' });
    }
});

// Mark all notifications as read
router.post('/mark-all-read', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.userId;
        const userRole = req.user?.role;

        const CANDIDATE_TYPES = ['NEW_EXAM_AVAILABLE', 'RESULT_RELEASED'];
        const ADMIN_TYPES = ['EXAM_SUBMITTED', 'NEW_USER_REGISTERED', 'NEW_ADMIN_REGISTERED'];

        const where: any = { isRead: false };

        if (userRole === 'SUPER_ADMIN') {
            where.type = { in: ADMIN_TYPES };
        } else if (userRole === 'ADMIN') {
            where.createdById = userId;
            where.type = { in: ADMIN_TYPES };
        } else {
            where.createdById = userId;
            where.type = { in: CANDIDATE_TYPES };
        }

        const result = await prisma.notification.updateMany({
            where,
            data: { isRead: true }
        });

        res.json({ message: 'All notifications marked as read', count: result.count });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
});

// Delete a notification
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const notificationId = req.params.id as string;
        const userId = req.user?.userId;
        const userRole = req.user?.role;

        const notification = await prisma.notification.findUnique({
            where: { id: notificationId }
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (userRole !== 'SUPER_ADMIN' && notification.createdById !== userId) {
            return res.status(403).json({ message: 'You do not have permission to delete this notification' });
        }

        await prisma.notification.delete({ where: { id: notificationId } });

        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ message: 'Failed to delete notification' });
    }
});

export default router;
