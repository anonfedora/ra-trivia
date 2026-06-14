import { Router, Response } from "express";
import { prisma } from "database";
import { authenticate, authorizeAdmin, AuthRequest } from "../middlewares/auth";
import { body } from "express-validator";
import { handleValidationErrors } from "../middlewares/errorHandler";
import { auditService } from "../services/auditService";
import { GoogleSheetsService } from "../services/googleSheets";

const router = Router();

router.get("/verify/:code", async (req: AuthRequest, res: Response) => {
  try {
    const code = req.params.code as string;

    // Check for temporary quiz QR codes (for existing candidates)
    const candidateQR = await prisma.candidateQR.findUnique({
      where: { attendanceCode: code },
      include: { user: true },
    });

    if (
      candidateQR &&
      candidateQR.isActive &&
      candidateQR.expiresAt > new Date()
    ) {
      const user = (candidateQR as any).user;
      return res.json({
        valid: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    }

    // Check for permanent attendee identity QR codes
    const attendeeQR = await prisma.attendeeIdentityQR.findUnique({
      where: { identityCode: code },
      include: { attendee: true },
    });

    if (
      attendeeQR &&
      attendeeQR.isActive &&
      attendeeQR.expiresAt > new Date()
    ) {
      const attendee = (attendeeQR as any).attendee;
      return res.json({
        valid: true,
        user: {
          id: attendee.id,
          name: attendee.fullName,
          email: attendee.email,
          church: attendee.church,
          isAttendee: true,
        },
      });
    }

    res.json({ valid: false });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ message: "Failed to verify code" });
  }
});

router.post(
  "/qr/scan",
  authenticate,
  authorizeAdmin,
  [
    body("attendanceCode").notEmpty().withMessage("Attendance code is required"),
    body("quizId").optional(),
    body("eventName").optional(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: any) => {
    try {
      const { attendanceCode, quizId, eventName } = req.body;
      const adminId = req.user!.userId;
      const adminRole = req.user!.role;

      if (!quizId && !eventName) {
        return res
          .status(400)
          .json({ message: "Either Quiz ID or Event Name is required" });
      }

      let userOrAttendeeData: any = null;
      let identityQR: any = null;
      let candidateQR: any = null;
      let isAttendee = false;

      let eventTitle = eventName || "Unknown Event";

      // First check if it's a permanent attendee QR code
      const attendeeQR = await prisma.attendeeIdentityQR.findFirst({
        where: {
          identityCode: attendanceCode,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        include: {
          attendee: true,
        },
      });

      if (attendeeQR) {
        userOrAttendeeData = attendeeQR.attendee;
        identityQR = attendeeQR;
        isAttendee = true;
      } else {
        // If not, check for temporary candidate QR codes (for existing users)
        candidateQR = await prisma.candidateQR.findFirst({
          where: {
            attendanceCode,
            isActive: true,
            expiresAt: { gt: new Date() },
          },
          include: {
            user: true,
          },
        });

        if (!candidateQR) {
          return res
            .status(400)
            .json({ message: "Invalid or expired attendance code" });
        }
        userOrAttendeeData = candidateQR.user;
      }

      // Verify quiz permissions if quizId is provided
      if (quizId) {
        const quiz = await prisma.quiz.findUnique({
          where: { id: quizId },
        });

        if (!quiz) {
          return res.status(404).json({ message: "Quiz not found" });
        }

        if (quiz.createdById !== adminId && adminRole !== "SUPER_ADMIN") {
          return res
            .status(403)
            .json({
              message: "Only quiz creator or superadmin can check in candidates for this quiz",
            });
        }
        eventTitle = quiz.title;
      }

      // Check if user/attendee already checked in for this quiz/event
      const whereClause: any = {};
      if (isAttendee) {
        whereClause.attendeeId = userOrAttendeeData.id;
      } else {
        whereClause.userId = userOrAttendeeData.id;
      }

      if (quizId) whereClause.quizId = quizId;
      if (eventName) whereClause.eventName = eventName;

      const existingAttendance = await prisma.attendanceRecord.findFirst({
        where: whereClause,
      });

      if (existingAttendance) {
        return res
          .status(400)
          .json({
            message: `Candidate already checked in for ${eventTitle}`,
          });
      }

      // Create attendance record
      const attendanceData: any = {
        checkedInAt: new Date(),
        checkedInBy: adminId,
        method: "QR_SCAN",
      };

      if (isAttendee) {
        attendanceData.attendeeId = userOrAttendeeData.id;
        attendanceData.attendeeQRId = identityQR.id;
      } else {
        attendanceData.userId = userOrAttendeeData.id;
        attendanceData.candidateQRId = candidateQR.id;
      }

      if (quizId) attendanceData.quizId = quizId;
      if (eventName) attendanceData.eventName = eventName;

      const attendanceRecord = await prisma.attendanceRecord.create({
        data: attendanceData,
      });

      const responseCandidate = isAttendee
        ? {
            id: userOrAttendeeData.id,
            name: userOrAttendeeData.fullName,
            email: userOrAttendeeData.email,
            church: userOrAttendeeData.church,
            isAttendee: true,
          }
        : {
            id: userOrAttendeeData.id,
            name: userOrAttendeeData.name,
            email: userOrAttendeeData.email,
            church: userOrAttendeeData.church,
          };

      // Append to Google Sheets
      try {
        const checkedInByName = isAttendee ? userOrAttendeeData.fullName : userOrAttendeeData.name || 'Admin';
        await GoogleSheetsService.appendAttendance({
          timestamp: attendanceRecord.checkedInAt.toISOString(),
          fullName: responseCandidate.name,
          church: responseCandidate.church,
          checkInTime: attendanceRecord.checkedInAt.toLocaleString(),
          method: attendanceRecord.method,
          checkedInBy: checkedInByName,
          eventName: eventTitle,
        });
        console.log('[Attendance Route] Appended attendance to Google Sheets.');
      } catch (gsError) {
        console.error('[Attendance Route] Failed to append attendance to Google Sheets:', gsError);
      }

      // Deactivate temporary QR codes after successful check-in, but keep permanent ones
      if (!isAttendee && candidateQR && !candidateQR.isPermanent) {
        await prisma.candidateQR.update({
          where: { id: candidateQR.id },
          data: { isActive: false },
        });
      }

      await auditService.log({
        userId: adminId,
        action: "CANDIDATE_CHECKED_IN",
        metadata: {
          details: `Checked in candidate ${
            isAttendee
              ? userOrAttendeeData.fullName
              : userOrAttendeeData.name
          } for ${eventTitle}`,
          candidateId: isAttendee
            ? userOrAttendeeData.id
            : userOrAttendeeData.id,
          isAttendee,
          quizId,
          eventName,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || undefined,
      });

      res.json({
        message: `Checked in successfully for ${eventTitle}`,
        attendance: {
          id: attendanceRecord.id,
          candidate: responseCandidate,
          checkedInAt: attendanceRecord.checkedInAt,
          method: attendanceRecord.method,
        },
      });
    } catch (error) {
      console.error("Failed to scan candidate QR code:", error);
      res
        .status(500)
        .json({ message: "Failed to scan candidate QR code" });
    }
  }
);

router.post(
  "/manual",
  authenticate,
  authorizeAdmin,
  [
    body("fullName").notEmpty().withMessage("Name is required"),
    body("church").optional(),
    body("eventName").optional(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: any) => {
    try {
      const { fullName, church, notes, eventName } = req.body;
      const adminId = req.user!.userId;

      const record = await prisma.manualAttendance.create({
        data: {
          fullName,
          church: church || null,
          checkInTime: new Date(),
          checkedInBy: adminId,
          eventName: eventName || null,
          notes: notes || null,
          method: "MANUAL_ENTRY",
        },
      });

      await auditService.logFromRequest(
        req,
        "MANUAL_ATTENDANCE_RECORDED",
        adminId,
        { fullName, church, eventName }
      );

      res.json(record);
    } catch (error) {
      console.error("Failed to record manual attendance:", error);
      res
        .status(500)
        .json({ message: "Failed to record attendance" });
    }
  }
);

router.get(
  "/manual",
  authenticate,
  authorizeAdmin,
  async (req: AuthRequest, res: any) => {
    try {
      const { startDate, endDate, church, eventName } = req.query;

      const getQueryParam = (param: any): string | undefined => {
        if (Array.isArray(param)) {
          return param[0];
        }
        return param as string | undefined;
      };

      let where: any = {};

      if (startDate || endDate) {
        where.checkInTime = {};
        const start = getQueryParam(startDate);
        const end = getQueryParam(endDate);
        if (start) {
          where.checkInTime.gte = new Date(start);
        }
        if (end) {
          const endDateObj = new Date(end);
          endDateObj.setHours(23, 59, 59, 999);
          where.checkInTime.lte = endDateObj;
        }
      }

      const churchParam = getQueryParam(church);
      if (churchParam) {
        where.church = churchParam;
      }

      const eventNameParam = getQueryParam(eventName);
      if (eventNameParam) {
        where.eventName = eventNameParam;
      }

      const records = await prisma.manualAttendance.findMany({
        where,
        orderBy: { checkInTime: "desc" },
      });

      res.json(records);
    } catch (error) {
      console.error("Failed to fetch manual attendance:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch attendance records" });
    }
  }
);

router.get(
  "/records",
  authenticate,
  authorizeAdmin,
  async (req: AuthRequest, res: any) => {
    try {
      const { startDate, endDate, eventName, church } = req.query;

      const getQueryParam = (param: any): string | undefined => {
        if (Array.isArray(param)) {
          return param[0];
        }
        return param as string | undefined;
      };

      let whereQR: any = {};
      let whereManual: any = {};

      if (startDate || endDate) {
        whereQR.checkedInAt = {};
        whereManual.checkInTime = {};
        const start = getQueryParam(startDate);
        const end = getQueryParam(endDate);
        if (start) {
          whereQR.checkedInAt.gte = new Date(start);
          whereManual.checkInTime.gte = new Date(start);
        }
        if (end) {
          const endDateObj = new Date(end);
          endDateObj.setHours(23, 59, 59, 999);
          whereQR.checkedInAt.lte = endDateObj;
          whereManual.checkInTime.lte = endDateObj;
        }
      }

      const eventNameParam = getQueryParam(eventName);
      if (eventNameParam) {
        whereQR.eventName = eventNameParam;
        whereManual.eventName = eventNameParam;
      }

      // Get QR attendance records
      const qrAttendance = await prisma.attendanceRecord.findMany({
        where: whereQR,
        include: {
          user: { select: { id: true, name: true, email: true, church: true } },
          attendee: {
            select: { id: true, fullName: true, email: true, church: true },
          },
          checkedInByAdmin: {
            select: { id: true, name: true },
          },
        },
        orderBy: { checkedInAt: "desc" },
      });

      // Get manual attendance records
      const manualAttendance = await prisma.manualAttendance.findMany({
        where: whereManual,
        orderBy: { checkInTime: "desc" },
      });

      // Normalize QR records
      const normalizedQR = qrAttendance
        .map((record) => {
          const fullName = record.attendee
            ? record.attendee.fullName
            : record.user?.name || "Unknown";
          const attendeeEmail = record.attendee
            ? record.attendee.email
            : record.user?.email;
          const attendeeChurch = record.attendee?.church;
          const churchParam = getQueryParam(church);

          let shouldInclude = true;
          if (churchParam) {
            if (attendeeChurch !== churchParam) shouldInclude = false;
          }

          if (!shouldInclude) return null;

          return {
            id: record.id,
            fullName,
            email: attendeeEmail || null,
            church: attendeeChurch || null,
            checkInTime: record.checkedInAt,
            method: record.method,
            checkedInBy: record.checkedInByAdmin.name,
            eventName: record.eventName || null,
            quizId: record.quizId || null,
            type: "QR_SCAN",
          };
        })
        .filter((item) => item !== null);

      const normalizedManual = manualAttendance
        .map((record) => {
          let shouldInclude = true;
          const churchParam = getQueryParam(church);
          if (churchParam) {
            if (record.church !== churchParam) shouldInclude = false;
          }

          if (!shouldInclude) return null;

          return {
            id: record.id,
            fullName: record.fullName,
            email: null,
            church: record.church,
            checkInTime: record.checkInTime,
            method: record.method,
            checkedInBy: "Admin",
            eventName: record.eventName,
            type: "MANUAL",
          };
        })
        .filter((item) => item !== null);

      const allRecords = [...normalizedQR, ...normalizedManual].sort(
        (a, b) =>
          new Date(b!.checkInTime).getTime() - new Date(a!.checkInTime).getTime()
      );

      res.json({
        attendanceRecords: allRecords,
      });
    } catch (error) {
      console.error("Failed to fetch attendance records:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch attendance records" });
    }
  }
);

export default router;
