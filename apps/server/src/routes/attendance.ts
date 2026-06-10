import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, AuthRequest, authorizeAdmin } from '../middlewares/auth';
import { QRService } from '../services/qrService';
import { auditService } from '../services/auditService';
import { GoogleSheetsService } from '../services/googleSheets';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middlewares/errorHandler';

const router = Router();

/**
 * @openapi
 * /attendance/qr/candidate:
 *   get:
 *     tags: [Attendance]
 *     summary: Generate candidate QR code for attendance check-in
 *     description: Generates a unique QR code for a candidate to be scanned by admin for attendance check-in
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Candidate QR code generated successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/qr/candidate', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user!.userId;
    
    // Generate unique attendance code for this candidate
    const attendanceCode = QRService.generateAttendanceCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Store candidate QR code in database
    await prisma.candidateQR.create({
      data: {
        userId,
        attendanceCode,
        expiresAt,
        isActive: true
      }
    });
    
    const attendanceLink = `${process.env.WEB_URL}/attendance/scan/${attendanceCode}`;
    
    res.json({
      attendanceCode,
      attendanceLink,
      expiresAt: expiresAt.toISOString(),
      qrData: JSON.stringify({
        type: 'candidate_attendance',
        userId,
        attendanceCode,
        expiresAt: expiresAt.toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to generate candidate QR code:', error);
    res.status(500).json({ message: 'Failed to generate candidate QR code' });
  }
});

/**
 * @openapi
 * /attendance/qr/scan:
 *   post:
 *     tags: [Attendance]
 *     summary: Admin scans candidate QR code for attendance check-in
 *     description: Admin scans candidate QR code to mark them as present for a specific exam
 *     security:
 *       - BearerAuth: []
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
 *         description: Candidate checked in successfully
 *       400:
 *         description: Invalid or expired QR code
 *       403:
 *         description: Forbidden - not quiz creator or superadmin
 */
router.post('/qr/scan', authenticate, authorizeAdmin, [
  body('attendanceCode').notEmpty().withMessage('Attendance code is required'),
  body('quizId').notEmpty().withMessage('Quiz ID is required')
], handleValidationErrors, async (req: AuthRequest, res: any) => {
  try {
    const { attendanceCode, quizId } = req.body;
    const adminId = req.user!.userId;
    const adminRole = req.user!.role;
    
    // Verify quiz permissions
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId }
    });
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    if (quiz.createdById !== adminId && adminRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only quiz creator or superadmin can check in candidates' });
    }
    
    // Find candidate QR code
    const candidateQR = await prisma.candidateQR.findFirst({
      where: {
        attendanceCode,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
    
    if (!candidateQR) {
      return res.status(400).json({ message: 'Invalid or expired attendance code' });
    }
    
    // Check if candidate already checked in for this quiz
    const existingAttendance = await prisma.attendanceRecord.findFirst({
      where: {
        userId: candidateQR.userId,
        quizId
      }
    });
    
    if (existingAttendance) {
      return res.status(400).json({ message: 'Candidate already checked in for this quiz' });
    }
    
    // Create attendance record
    const attendanceRecord = await prisma.attendanceRecord.create({
      data: {
        userId: candidateQR.userId,
        quizId,
        checkedInAt: new Date(),
        checkedInBy: adminId,
        method: 'QR_SCAN'
      }
    });
    
    // Deactivate the QR code after successful check-in
    await prisma.candidateQR.update({
      where: { id: candidateQR.id },
      data: { isActive: false }
    });
    
    // Log the action
    await auditService.log({
      userId: adminId,
      action: 'CANDIDATE_CHECKED_IN',
      metadata: {
        details: `Checked in candidate ${candidateQR.user.email} for quiz ${quiz.title}`
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined
    });
    
    res.json({
      message: 'Candidate checked in successfully',
      attendance: {
        id: attendanceRecord.id,
        candidate: candidateQR.user,
        checkedInAt: attendanceRecord.checkedInAt,
        method: attendanceRecord.method
      }
    });
  } catch (error) {
    console.error('Failed to scan candidate QR code:', error);
    res.status(500).json({ message: 'Failed to scan candidate QR code' });
  }
});

/**
 * @openapi
 * /attendance/quiz/{quizId}/candidates:
 *   get:
 *     tags: [Attendance]
 *     summary: Get attendance records for a quiz
 *     description: Returns list of candidates checked in for a specific quiz with their exam status
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
 *         description: Attendance records retrieved successfully
 *       403:
 *         description: Forbidden - not quiz creator or superadmin
 *       404:
 *         description: Quiz not found
 */
router.get('/quiz/:quizId/candidates', authenticate, authorizeAdmin, async (req: AuthRequest, res: any) => {
  try {
    const quizIdParam = req.params.quizId;
    const quizId = Array.isArray(quizIdParam) ? quizIdParam[0] : quizIdParam;
    const adminId = req.user!.userId;
    const adminRole = req.user!.role;
    
    // Verify quiz permissions
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId }
    });
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    if (quiz.createdById !== adminId && adminRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only quiz creator or superadmin can view attendance records' });
    }
    
    // Get attendance records with exam status
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: { quizId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        checkedInByAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { checkedInAt: 'asc' }
    });
    
    // Get exam session status for each candidate
    const candidatesWithStatus = await Promise.all(
      attendanceRecords.map(async (record) => {
        const session = await prisma.quizSession.findFirst({
          where: {
            userId: record.userId,
            quizId
          },
          select: {
            id: true,
            startTime: true,
            endTime: true
          },
          orderBy: { startTime: 'desc' }
        });
        
        return {
          id: record.id,
          candidate: record.user,
          checkedInAt: record.checkedInAt,
          checkedInBy: record.checkedInByAdmin,
          method: record.method,
          examStatus: session ? {
            sessionId: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            status: session.endTime ? 'SUBMITTED' : 'IN_PROGRESS'
          } : null
        };
      })
    );
    
    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        totalCandidates: candidatesWithStatus.length,
        checkedInCount: candidatesWithStatus.length,
        startedExamCount: candidatesWithStatus.filter(c => c.examStatus?.startTime).length,
        submittedExamCount: candidatesWithStatus.filter(c => c.examStatus?.endTime).length
      },
      candidates: candidatesWithStatus
    });
  } catch (error) {
    console.error('Failed to get attendance records:', error);
    res.status(500).json({ message: 'Failed to get attendance records' });
  }
});

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
    const quizIdParam = req.params.quizId;
    const quizId = Array.isArray(quizIdParam) ? quizIdParam[0] : quizIdParam;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
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
    const attendanceCodeParam = req.params.attendanceCode;
    const attendanceCode = Array.isArray(attendanceCodeParam) ? attendanceCodeParam[0] : attendanceCodeParam;

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

// Manual Attendance Endpoints
router.post('/manual', authenticate, authorizeAdmin, [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('church').optional(),
  body('checkInTime').optional(),
  body('method').optional().default('MANUAL_ENTRY'),
  body('checkedInBy').optional(),
  body('eventName').optional(),
  body('notes').optional()
], handleValidationErrors, async (req: AuthRequest, res: any) => {
  try {
    const { fullName, church, checkInTime, method, checkedInBy, eventName, notes } = req.body;
    const userId = req.user?.userId;

    // Fetch user from database to get their name
    let adminName: string | undefined = checkedInBy;
    if (!adminName && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      adminName = user?.name;
    }

    const attendance = await prisma.manualAttendance.create({
      data: {
        fullName,
        church,
        checkInTime: checkInTime ? new Date(checkInTime) : new Date(),
        method: method || 'MANUAL_ENTRY',
        checkedInBy: adminName,
        eventName,
        notes
      }
    });

    // Append to Google Sheets
    await GoogleSheetsService.appendAttendance({
      timestamp: new Date().toISOString(),
      fullName,
      church: church || undefined,
      checkInTime: attendance.checkInTime.toISOString(),
      method: attendance.method,
      checkedInBy: attendance.checkedInBy || undefined,
      eventName: attendance.eventName || undefined,
      notes: attendance.notes || undefined
    });

    // Log the action
    await auditService.logFromRequest(req, 'MANUAL_ATTENDANCE_CREATED', undefined, {
      attendanceId: attendance.id,
      fullName
    });

    res.json({
      message: 'Manual attendance recorded successfully',
      attendance
    });
  } catch (error) {
    console.error('Failed to record manual attendance:', error);
    res.status(500).json({ message: 'Failed to record manual attendance' });
  }
});

router.get('/manual', authenticate, authorizeAdmin, async (req: AuthRequest, res: any) => {
  try {
    const { startDate, endDate, church, eventName } = req.query;
    
    const where: any = {};
    
    if (startDate && endDate) {
      where.checkInTime = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }
    
    if (church) {
      where.church = church;
    }
    
    if (eventName) {
      where.eventName = eventName;
    }

    const attendanceRecords = await prisma.manualAttendance.findMany({
      where,
      orderBy: { checkInTime: 'desc' }
    });

    res.json({
      attendanceRecords
    });
  } catch (error) {
    console.error('Failed to fetch manual attendance:', error);
    res.status(500).json({ message: 'Failed to fetch manual attendance' });
  }
});

router.get('/manual/:id', authenticate, authorizeAdmin, async (req: AuthRequest, res: any) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const attendance = await prisma.manualAttendance.findUnique({
      where: { id }
    });

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    res.json({ attendance });
  } catch (error) {
    console.error('Failed to fetch manual attendance:', error);
    res.status(500).json({ message: 'Failed to fetch manual attendance' });
  }
});

router.delete('/manual/:id', authenticate, authorizeAdmin, async (req: AuthRequest, res: any) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    await prisma.manualAttendance.delete({
      where: { id }
    });

    // Log the action
    await auditService.logFromRequest(req, 'MANUAL_ATTENDANCE_DELETED', undefined, {
      attendanceId: id
    });

    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Failed to delete manual attendance:', error);
    res.status(500).json({ message: 'Failed to delete manual attendance' });
  }
});

export default router;
