import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, AuthRequest, authorizeAdmin } from '../middlewares/auth';
import { QRService } from '../services/qrService';
import { auditService } from '../services/auditService';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middlewares/errorHandler';

const router = Router();

/**
 * @openapi
 * /attendance/qr/generate:
 *   post:
 *     tags: [Attendance]
 *     summary: Generate QR code for exam attendance
 *     description: Creates or refreshes QR code and attendance link for a specific exam. Only exam creator or superadmin can generate.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quizId]
 *             properties:
 *               quizId:
 *                 type: string
 *               expiresHours:
 *                 type: number
 *                 default: 2
 *     responses:
 *       200:
 *         description: QR code generated successfully
 *       403:
 *         description: Forbidden - not quiz creator or superadmin
 *       404:
 *         description: Quiz not found
 */
router.post('/qr/generate', authenticate, authorizeAdmin, [
  body('quizId').notEmpty().withMessage('Quiz ID is required'),
  body('expiresHours').optional().isInt({ min: 1, max: 24 }).withMessage('Expiration hours must be between 1 and 24')
], handleValidationErrors, async (req: AuthRequest, res: any) => {
  try {
    const { quizId, expiresHours = 2 } = req.body;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId as string }
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is quiz creator or superadmin
    if (quiz.createdById !== userId && userRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        message: 'Forbidden: Only quiz creator or superadmin can generate QR codes' 
      });
    }

    // Generate new attendance code and expiration
    const attendanceCode = QRService.generateAttendanceCode();
    const expiresAt = QRService.generateExpirationTime(expiresHours);

    // Update quiz with QR attendance data
    const updatedQuiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        enableQRAttendance: true,
        qrAttendanceCode: attendanceCode,
        qrCodeExpiresAt: expiresAt
      }
    });

    // Generate QR code
    const attendanceData = QRService.createAttendanceData(updatedQuiz);
    const qrCodeDataUrl = await QRService.generateQRCode(attendanceData);
    const attendanceLink = QRService.generateAttendanceLink(attendanceCode);

    // Log QR code generation
    await auditService.logFromRequest(req, 'QR_CODE_GENERATED', quizId, {
      attendanceCode,
      expiresAt: expiresAt.toISOString(),
      expiresHours
    });

    res.json({
      message: 'QR code generated successfully',
      qrCode: qrCodeDataUrl,
      attendanceLink,
      attendanceCode,
      expiresAt: expiresAt.toISOString(),
      enableQRAttendance: true
    });

  } catch (error) {
    console.error('[ATTENDANCE] QR generation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /attendance/qr/status/{quizId}:
 *   get:
 *     tags: [Attendance]
 *     summary: Get QR attendance status for a quiz
 *     description: Returns current QR code status and whether it needs refresh. Only quiz creator or superadmin can view.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QR attendance status
 *       403:
 *         description: Forbidden - not quiz creator or superadmin
 *       404:
 *         description: Quiz not found
 */
router.get('/qr/status/:quizId', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId as string },
      select: {
        id: true,
        title: true,
        enableQRAttendance: true,
        qrAttendanceCode: true,
        qrCodeExpiresAt: true,
        createdById: true
      }
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is quiz creator or superadmin
    if (quiz.createdById !== userId && userRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        message: 'Forbidden: Only quiz creator or superadmin can view QR status' 
      });
    }

    const needsRefresh = QRService.needsRefresh(quiz.qrCodeExpiresAt);
    const isExpired = quiz.qrCodeExpiresAt ? new Date() > new Date(quiz.qrCodeExpiresAt) : true;

    res.json({
      quizId: quiz.id,
      quizTitle: quiz.title,
      enableQRAttendance: quiz.enableQRAttendance,
      hasValidQR: quiz.enableQRAttendance && quiz.qrAttendanceCode && !isExpired,
      needsRefresh,
      expiresAt: quiz.qrCodeExpiresAt?.toISOString() || null,
      attendanceCode: quiz.qrAttendanceCode || null
    });

  } catch (error) {
    console.error('[ATTENDANCE] QR status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /attendance/qr/disable:
 *   post:
 *     tags: [Attendance]
 *     summary: Disable QR attendance for a quiz
 *     description: Disables QR code attendance for a specific exam. Only quiz creator or superadmin can disable.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quizId]
 *             properties:
 *               quizId:
 *                 type: string
 *     responses:
 *       200:
 *         description: QR attendance disabled successfully
 *       403:
 *         description: Forbidden - not quiz creator or superadmin
 *       404:
 *         description: Quiz not found
 */
router.post('/qr/disable', authenticate, authorizeAdmin, [
  body('quizId').notEmpty().withMessage('Quiz ID is required')
], handleValidationErrors, async (req: AuthRequest, res: any) => {
  try {
    const { quizId } = req.body;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId as string }
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is quiz creator or superadmin
    if (quiz.createdById !== userId && userRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        message: 'Forbidden: Only quiz creator or superadmin can disable QR attendance' 
      });
    }

    // Disable QR attendance
    await prisma.quiz.update({
      where: { id: quizId },
      data: {
        enableQRAttendance: false,
        qrAttendanceCode: null,
        qrCodeExpiresAt: null
      }
    });

    // Log QR attendance disable
    await auditService.logFromRequest(req, 'QR_ATTENDANCE_DISABLED', quizId);

    res.json({
      message: 'QR attendance disabled successfully',
      enableQRAttendance: false
    });

  } catch (error) {
    console.error('[ATTENDANCE] QR disable error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /attendance/verify:
 *   post:
 *     tags: [Attendance]
 *     summary: Verify attendance code and mark attendance
 *     description: Verifies QR or link attendance code and marks user as attended for the exam.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [attendanceCode, quizId]
 *             properties:
 *               attendanceCode:
 *                 type: string
 *               quizId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Attendance verified successfully
 *       400:
 *         description: Invalid or expired attendance code
 *       404:
 *         description: Quiz not found
 */
router.post('/verify', [
  body('attendanceCode').notEmpty().withMessage('Attendance code is required'),
  body('quizId').notEmpty().withMessage('Quiz ID is required')
], handleValidationErrors, async (req: AuthRequest, res: any) => {
  try {
    const { attendanceCode, quizId } = req.body;
    const userId = req.user?.userId; // Optional - for logged in users
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ipAddress = req.ip || (req as any).connection?.remoteAddress || null;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId as string }
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Verify attendance code
    const isValidCode = QRService.verifyAttendanceCode(quiz, attendanceCode);
    
    if (!isValidCode) {
      return res.status(400).json({ 
        message: 'Invalid or expired attendance code' 
      });
    }

    // If user is logged in, check if they already have attendance verified for this quiz
    if (userId) {
      const existingSession = await prisma.quizSession.findFirst({
        where: {
          userId,
          quizId,
          attendanceVerifiedAt: { not: null }
        }
      });

      if (existingSession) {
        return res.json({
          message: 'Attendance already verified',
          alreadyVerified: true,
          verifiedAt: existingSession.attendanceVerifiedAt
        });
      }
    }

    // Mark attendance (create or update session)
    const attendanceData = {
      attendanceVerifiedAt: new Date(),
      attendanceMethod: userAgent.includes('Mobile') ? 'QR_CODE' : 'LINK_CODE'
    };

    let session;
    if (userId) {
      // For logged-in users, find existing session or create new one
      const existingSession = await prisma.quizSession.findFirst({
        where: {
          userId,
          quizId,
          endTime: null // Only update active sessions
        }
      });

      if (existingSession) {
        // Update existing session
        session = await prisma.quizSession.update({
          where: { id: existingSession.id },
          data: attendanceData
        });
      } else {
        // Create new session
        session = await prisma.quizSession.create({
          data: {
            userId,
            quizId,
            startTime: new Date(),
            answers: {},
            ipAddress,
            ...attendanceData
          }
        });
      }
    } else {
      // For anonymous users, we can't create a session without userId
      // Just return success for verification
      session = { attendanceVerifiedAt: attendanceData.attendanceVerifiedAt };
    }

    // Log attendance verification
    if (userId) {
      await auditService.logFromRequest(req, 'ATTENDANCE_VERIFIED', quizId, {
        attendanceCode,
        method: attendanceData.attendanceMethod
      });
    }

    res.json({
      message: 'Attendance verified successfully',
      verifiedAt: session.attendanceVerifiedAt,
      method: attendanceData.attendanceMethod,
      quizTitle: quiz.title
    });

  } catch (error) {
    console.error('[ATTENDANCE] Verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /attendance/public/{attendanceCode}:
 *   get:
 *     tags: [Attendance]
 *     summary: Get public attendance information
 *     description: Returns public quiz information for attendance verification without authentication.
 *     parameters:
 *       - in: path
 *         name: attendanceCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public attendance information
 *       404:
 *         description: Invalid or expired attendance code
 */
router.get('/public/:attendanceCode', async (req, res) => {
  try {
    const { attendanceCode } = req.params;

    // Find quiz with this attendance code
    const quiz = await prisma.quiz.findFirst({
      where: {
        qrAttendanceCode: attendanceCode.toUpperCase(),
        enableQRAttendance: true,
        qrCodeExpiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        title: true,
        duration: true,
        qrCodeExpiresAt: true
      }
    });

    if (!quiz) {
      return res.status(404).json({ 
        message: 'Invalid or expired attendance code' 
      });
    }

    res.json({
      quizId: quiz.id,
      quizTitle: quiz.title,
      duration: quiz.duration,
      expiresAt: quiz.qrCodeExpiresAt?.toISOString() || null,
      valid: true
    });

  } catch (error) {
    console.error('[ATTENDANCE] Public info error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
