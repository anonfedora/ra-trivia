import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, authorizeAdmin, AuthRequest } from '../middlewares/auth';
import { emitToRoom } from '../services/socketService';

const router = Router();

// Admin: Get all support threads (grouped by user)
router.get('/admin', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const supportMessages = await prisma.supportMessage.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        // Group by userId and get the latest message and unread count for each user
        const threadsMap = new Map();
        
        // We need all messages to calculate unread counts correctly, 
        // or we could do a separate count query. Let's stick with grouping for now
        // but fetch them in a way that we can count.
        
        for (const msg of supportMessages) {
            if (!threadsMap.has(msg.userId)) {
                threadsMap.set(msg.userId, {
                    userId: msg.userId,
                    user: msg.user,
                    latestMessage: msg.message,
                    latestCreatedAt: msg.createdAt,
                    status: msg.status,
                    unreadCount: 0
                });
            }
            
            // Count unread messages from the candidate (isAdmin: false)
            if (!msg.isAdmin && !msg.isRead) {
                const thread = threadsMap.get(msg.userId);
                thread.unreadCount++;
            }
        }

        res.json(Array.from(threadsMap.values()));
    } catch (error) {
        console.error('Admin support list error:', error);
        res.status(500).json({ message: 'Failed to fetch support threads' });
    }
});

// Admin: Get support history for a specific user
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

// Admin: Reply to a support request
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

// Admin: Mark all messages from a user as read
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

// Candidate: Get support history for the logged-in user
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
