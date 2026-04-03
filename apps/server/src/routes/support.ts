import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, authorizeAdmin, AuthRequest } from '../middlewares/auth';
import { emitToRoom } from '../services/socketService';

const router = Router();

/**
 * @openapi
 * /support/admin/templates:
 *   get:
 *     tags: [Support Admin]
 *     summary: Get canned response templates
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of templates
 */
router.get('/admin/templates', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    const templates = [
        { id: '1', title: 'Greeting', content: 'Hello! How can we help you today?' },
        { id: '2', title: 'Checking', content: 'We are looking into your request. Please give us a moment.' },
        { id: '3', title: 'Resolved', content: 'The issue has been resolved. Is there anything else you need help with?' },
        { id: '4', title: 'Exam Technical', content: 'If you are facing technical issues during the exam, please try refreshing the page or checking your internet connection.' },
        { id: '5', title: 'Result Delay', content: 'Results are typically released within 24-48 hours after the exam completion. You will receive a notification once they are ready.' }
    ];
    res.json(templates);
});

/**
 * @openapi
 * /support/admin:
 *   get:
 *     tags: [Support Admin]
 *     summary: List all support threads
 *     description: Grouped by user, showing latest message and unread counts.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of threads
 */
router.get('/admin', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
        const unreadOnly = req.query.unreadOnly === 'true';
        const userType = req.query.userType as string | undefined;
        const search = req.query.search as string | undefined;

        // Base where clause for support messages
        const where: any = {};
        
        if (unreadOnly) {
            where.isRead = false;
            where.isAdmin = false;
        }

        // We need to fetch users first if we want to filter by userType or search
        const userWhere: any = {};
        if (userType) userWhere.userType = userType;
        if (search) {
            userWhere.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Get all unique user IDs who have support messages
        const supportUserIds = await prisma.supportMessage.findMany({
            where,
            select: { userId: true },
            distinct: ['userId']
        });

        const targetUserIds = supportUserIds.map(s => s.userId);

        // Filter these user IDs by user criteria
        const users = await prisma.user.findMany({
            where: {
                id: { in: targetUserIds },
                ...userWhere
            },
            select: { id: true, name: true, email: true, userType: true }
        });

        const filteredUserIds = users.map(u => u.id);

        // Get total count for pagination
        const totalThreads = filteredUserIds.length;

        // Fetch latest messages for these users with pagination
        // Since Prisma doesn't easily support "distinct on" with pagination and ordering,
        // we'll fetch all latest messages for the filtered users and paginate in memory
        // OR we can fetch user by user. Let's do a more efficient query.
        
        const latestMessages = await Promise.all(
            filteredUserIds.map(async (userId) => {
                const latest = await prisma.supportMessage.findFirst({
                    where: { userId },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, userType: true }
                        }
                    }
                });
                
                const unreadCount = await prisma.supportMessage.count({
                    where: { userId, isAdmin: false, isRead: false }
                });

                return {
                    userId,
                    user: latest?.user,
                    latestMessage: latest?.message,
                    latestCreatedAt: latest?.createdAt,
                    status: latest?.status,
                    unreadCount
                };
            })
        );

        // Sort by latest message date descending
        const sortedThreads = latestMessages.sort((a, b) => 
            new Date(b.latestCreatedAt!).getTime() - new Date(a.latestCreatedAt!).getTime()
        );

        // Paginate
        const paginatedThreads = sortedThreads.slice((page - 1) * pageSize, page * pageSize);

        res.json({
            threads: paginatedThreads,
            pagination: {
                total: totalThreads,
                page,
                pageSize,
                totalPages: Math.ceil(totalThreads / pageSize)
            }
        });
    } catch (error) {
        console.error('Admin support list error:', error);
        res.status(500).json({ message: 'Failed to fetch support threads' });
    }
});

/**
 * @openapi
 * /support/admin/{userId}:
 *   get:
 *     tags: [Support Admin]
 *     summary: Get user support history
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full message history
 */
router.get('/admin/:userId', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const userId = req.params.userId as string;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const supportMessages = await prisma.supportMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        // Admins only see relevant context notifications (like results released) in the support thread
        const SUPPORT_CONTEXT_NOTIFICATION_TYPES = ['RESULT_RELEASED'];

        const notifications = await prisma.notification.findMany({
            where: {
                candidateEmail: user.email as string,
                type: { in: SUPPORT_CONTEXT_NOTIFICATION_TYPES }
            },
            orderBy: { createdAt: 'asc' }
        });

        const history = [
            ...supportMessages.map(m => ({ ...m, type: 'MESSAGE' })),
            ...notifications.map(n => ({ ...n, type: 'NOTIFICATION', isAdmin: true }))
        ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        res.json({
            user,
            history
        });
    } catch (error) {
        console.error('Admin support history error:', error);
        res.status(500).json({ message: 'Failed to fetch user support history' });
    }
});

/**
 * @openapi
 * /support/admin/{userId}:
 *   post:
 *     tags: [Support Admin]
 *     summary: Reply to user support request
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reply sent
 */
router.post('/admin/:userId', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const userId = req.params.userId as string;
        const { message, quizId } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ message: 'Message is required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const supportMessage = await prisma.supportMessage.create({
            data: {
                userId,
                quizId: quizId || null,
                message,
                isAdmin: true, // This is an admin reply
            }
        });

        // Emit real-time notification to the candidate's private room
        emitToRoom(`user:${userId}`, 'support_reply', supportMessage);

        res.status(201).json({ 
            message: 'Reply sent successfully',
            supportMessage 
        });
    } catch (error) {
        console.error('Admin reply error:', error);
        res.status(500).json({ message: 'Failed to send reply' });
    }
});

// Admin: Get global unread support message count
router.get('/admin/unread-count', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const unreadCount = await prisma.supportMessage.count({
            where: {
                isAdmin: false,
                isRead: false
            }
        });
        res.json({ unreadCount });
    } catch (error) {
        console.error('Admin unread count error:', error);
        res.status(500).json({ message: 'Failed to fetch unread count' });
    }
});

/**
 * @openapi
 * /support/admin/{userId}/read:
 *   patch:
 *     tags: [Support Admin]
 *     summary: Mark user messages as read
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages marked as read
 */
router.patch('/admin/:userId/read', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const userId = req.params.userId as string;

        await prisma.supportMessage.updateMany({
            where: {
                userId,
                isAdmin: false,
                isRead: false
            },
            data: { isRead: true }
        });

        // Notify the candidate that their messages were read
        emitToRoom(`user:${userId}`, 'messages_read', { userId, byAdmin: true });

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Admin mark as read error:', error);
        res.status(500).json({ message: 'Failed to mark messages as read' });
    }
});

// Admin: Mark support thread as resolved
router.patch('/admin/:userId/resolve', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const userId = req.params.userId as string;

        await prisma.supportMessage.updateMany({
            where: { 
                userId,
                status: 'PENDING'
            },
            data: { status: 'RESOLVED' }
        });

        res.json({ message: 'Support thread marked as resolved' });
    } catch (error) {
        console.error('Resolve support thread error:', error);
        res.status(500).json({ message: 'Failed to resolve support thread' });
    }
});

/**
 * @openapi
 * /support:
 *   get:
 *     tags: [Support Candidate]
 *     summary: Get my support history
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Message history
 */
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Fetch support messages for this user
        const supportMessages = await prisma.supportMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        // Fetch notifications for this user that are support-related or relevant
        // Candidates only see candidate-scoped notification types
        const CANDIDATE_NOTIFICATION_TYPES = ['NEW_EXAM_AVAILABLE', 'RESULT_RELEASED'];
        
        const notifications = await prisma.notification.findMany({
            where: {
                candidateEmail: user.email as string,
                type: { in: CANDIDATE_NOTIFICATION_TYPES }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Combine and sort by date
        const history = [
            ...supportMessages.map(m => ({ ...m, type: 'MESSAGE' })),
            ...notifications.map(n => ({ ...n, type: 'NOTIFICATION', isAdmin: true })) // Notifications are from "system/admin"
        ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        res.json(history);
    } catch (error) {
        console.error('Fetch support history error:', error);
        res.status(500).json({ message: 'Failed to fetch support history' });
    }
});

// Candidate: Get unread support message count
router.get('/unread-count', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const unreadCount = await prisma.supportMessage.count({
            where: {
                userId,
                isAdmin: true,
                isRead: false
            }
        });
        res.json({ unreadCount });
    } catch (error) {
        console.error('Candidate unread count error:', error);
        res.status(500).json({ message: 'Failed to fetch unread count' });
    }
});

// Candidate: Mark all messages from admins as read
router.patch('/read', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        await prisma.supportMessage.updateMany({
            where: {
                userId,
                isAdmin: true,
                isRead: false
            },
            data: { isRead: true }
        });

        // Notify admins that their messages were read
        emitToRoom('admin', 'messages_read', { userId, byCandidate: true });

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Candidate mark as read error:', error);
        res.status(500).json({ message: 'Failed to mark messages as read' });
    }
});

/**
 * @openapi
 * /support:
 *   post:
 *     tags: [Support Candidate]
 *     summary: Submit a new support request
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *               quizId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Request submitted
 */
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { message, quizId } = req.body;
        const userId = req.user!.userId;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ message: 'Message is required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const supportMessage = await prisma.supportMessage.create({
            data: {
                userId,
                quizId: quizId || null,
                message,
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                quiz: {
                    select: {
                        title: true
                    }
                }
            }
        });

        // Create notification for Super Admins
        const notification = await prisma.notification.create({
            data: {
                type: 'SUPPORT_REQUEST',
                title: 'New Support Request',
                message: `${user.name} reported an issue: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
                candidateName: user.name,
                candidateEmail: user.email,
                quizId: quizId || null,
            }
        });

        // Emit real-time notification to all admins for the dashboard list
        emitToRoom('admin', 'notification', notification);
        // Emit specifically to the support room for real-time chat updates
        emitToRoom('admin', 'support_message', supportMessage);

        res.status(201).json({ 
            message: 'Support request submitted successfully',
            supportMessage 
        });
    } catch (error) {
        console.error('Support request error:', error);
        res.status(500).json({ message: 'Failed to submit support request' });
    }
});

export default router;
