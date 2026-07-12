import { Router, Response } from "express";
import { prisma, UserType } from "database";
import { authenticate, authorizeAdmin, AuthRequest } from "../middlewares/auth";
import { sendGeneralAnnouncementEmail } from "../services/email";
import * as xlsx from "xlsx";
import { ReportGenerator } from "../services/reportGenerator";
import { emitNotification } from "../services/socketService";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import { sendBulkWelcomeEmail, generateOTP } from "../services/email";
import { auditService } from "../services/auditService";
import { QRService } from "../services/qrService";
import { body } from "express-validator";
import { handleValidationErrors } from "../middlewares/errorHandler";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const WEB_URL = process.env.WEB_URL || "http://localhost:3000";

/**
 * @openapi
 * /admin/register-candidate:
 *   post:
 *     tags: [Admin Candidates]
 *     summary: Register a new candidate and generate identity QR
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/register-candidate",
  authenticate,
  authorizeAdmin,
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").optional().isEmail().withMessage("Valid email is required"),
    body("church").optional(),
    body("phoneNumber").optional(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, email, church, phoneNumber } = req.body;
      const adminId = req.user?.userId;

      // Generate unique identity code
      const identityCode = QRService.generateAttendanceCode();

      // Create new attendee
      const attendee = await prisma.attendee.create({
        data: {
          fullName: name,
          email: email || null,
          church: church || null,
          phoneNumber: phoneNumber || null,
          identityCode,
          registeredById: adminId!,
        },
      });

      // Create permanent identity QR
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 100);
      const identityQR = await prisma.attendeeIdentityQR.create({
        data: {
          attendeeId: attendee.id,
          identityCode,
          expiresAt,
          isActive: true,
        },
      });

      const qrCode = await QRService.generateCandidateQRCode(identityCode, attendee.fullName);

      res.json({
        message: "Candidate registered successfully",
        candidate: {
          id: attendee.id,
          fullName: attendee.fullName,
          email: attendee.email,
          church: attendee.church,
          phoneNumber: attendee.phoneNumber,
        },
        qrCode,
        identityCode,
      });

      await auditService.logFromRequest(
        req,
        "CANDIDATE_REGISTERED_WITH_QR",
        adminId,
        {
          name: attendee.fullName,
          identityCode,
          attendeeId: attendee.id,
        }
      );
    } catch (error) {
      console.error("Candidate registration error:", error);
      res.status(500).json({ message: "Failed to register candidate" });
    }
  }
);

/**
 * @openapi
 * /admin/candidates/identities:
 *   get:
 *     tags: [Admin Candidates]
 *     summary: Get all candidates with their permanent QR identities
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/candidates/identities",
  authenticate,
  authorizeAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.userId;
      const adminRole = req.user?.role;

      const where: any = {};
      if (adminRole === "ADMIN") {
        where.registeredById = adminId;
      }

      const attendees = await prisma.attendee.findMany({
        where,
        include: {
          identityQr: true,
        },
        orderBy: { fullName: "asc" },
      });

      // Generate QR codes for attendees who don't have them yet
      const results = await Promise.all(
        attendees.map(async (attendee) => {
          let identityQR = attendee.identityQr;

          if (!identityQR) {
            const identityCode = QRService.generateAttendanceCode();
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 100);

            identityQR = await prisma.attendeeIdentityQR.create({
              data: {
                attendeeId: attendee.id,
                identityCode,
                expiresAt,
                isActive: true,
              },
            });

            await prisma.attendee.update({
              where: { id: attendee.id },
              data: { identityCode },
            });
          }

          const qrCode = await QRService.generateCandidateQRCode(
            identityQR.identityCode, attendee.fullName
          );

          return {
            id: attendee.id,
            fullName: attendee.fullName,
            email: attendee.email,
            church: attendee.church,
            phoneNumber: attendee.phoneNumber,
            identityCode: identityQR.identityCode,
            qrCode,
          };
        })
      );

      res.json(results);
    } catch (error) {
      console.error("Failed to fetch candidate identities:", error);
      res.status(500).json({ message: "Failed to fetch candidate identities" });
    }
  }
);

/**
 * @openapi
 * /admin/attendees:
 *   get:
 *     tags: [Admin]
 *     summary: Get all attendees with pagination and filtering
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/attendees",
  authenticate,
  authorizeAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.userId;
      const adminRole = req.user?.role;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 25;
      const search = req.query.search as string;
      const status = req.query.status as string;
      const church = req.query.church as string;

      const where: any = {};
      
      // Filter by admin if not SUPER_ADMIN
      if (adminRole === "ADMIN") {
        where.registeredById = adminId;
      }

      // Search filter
      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search, mode: "insensitive" } },
        ];
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      // Church filter
      if (church) {
        where.church = church;
      }

      const [attendees, total] = await Promise.all([
        prisma.attendee.findMany({
          where,
          include: {
            identityQr: true,
            registeredBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { registeredAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.attendee.count({ where }),
      ]);

      res.json({
        items: attendees,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      console.error("Failed to fetch attendees:", error);
      res.status(500).json({ message: "Failed to fetch attendees" });
    }
  }
);

/**
 * @openapi
 * /admin/attendees/:id:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete an attendee
 *     security:
 *       - BearerAuth: []
 */
router.delete(
  "/attendees/:id",
  authenticate,
  authorizeAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.userId;
      const adminRole = req.user?.role;

      const where: any = { id };
      
      // Only allow admins to delete attendees they registered
      if (adminRole === "ADMIN") {
        where.registeredById = adminId;
      }

      // Delete related records first (cascade manually)
      await prisma.attendanceRecord.deleteMany({
        where: { attendeeId: id as string }
      });
      
      await prisma.attendeeIdentityQR.deleteMany({
        where: { attendeeId: id as string }
      });

      // Delete attendee
      await prisma.attendee.delete({ where });

      await auditService.logFromRequest(
        req,
        "ATTENDEE_DELETED",
        adminId,
        { attendeeId: id }
      );

      res.json({ message: "Attendee deleted successfully" });
    } catch (error) {
      console.error("Failed to delete attendee:", error);
      res.status(500).json({ message: "Failed to delete attendee" });
    }
  }
);

/**
 * @openapi
 * /admin/attendees/:id/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Update attendee status
 *     security:
 *       - BearerAuth: []
 */
router.patch(
  "/attendees/:id/status",
  authenticate,
  authorizeAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const adminId = req.user?.userId;
      const adminRole = req.user?.role;

      const where: any = { id };
      
      // Only allow admins to update attendees they registered
      if (adminRole === "ADMIN") {
        where.registeredById = adminId;
      }

      const attendee = await prisma.attendee.update({
        where,
        data: {
          status,
          ...(notes !== undefined && { notes }),
        },
      });

      await auditService.logFromRequest(
        req,
        "ATTENDEE_STATUS_UPDATED",
        adminId,
        { attendeeId: id, status, notes }
      );

      res.json({ message: "Attendee status updated successfully", attendee });
    } catch (error) {
      console.error("Failed to update attendee status:", error);
      res.status(500).json({ message: "Failed to update attendee status" });
    }
  }
);

/**
 * @openapi
 * /admin/attendees/:id/attendance:
 *   get:
 *     tags: [Admin]
 *     summary: Get attendance history for an attendee
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/attendees/:id/attendance",
  authenticate,
  authorizeAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.userId;
      const adminRole = req.user?.role;

      const attendeeId = Array.isArray(id) ? id[0] : id;

      // Verify attendee exists and user has access
      const attendee = await prisma.attendee.findUnique({
        where: { id: attendeeId },
      });

      if (!attendee) {
        return res.status(404).json({ message: "Attendee not found" });
      }

      // Only allow admins to view attendees they registered
      if (adminRole === "ADMIN" && attendee.registeredById !== adminId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get attendance records
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: { attendeeId: attendeeId },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
            },
          },
          checkedInByAdmin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { checkedInAt: "desc" },
      });

      res.json({
        attendee: {
          id: attendee.id,
          fullName: attendee.fullName,
          email: attendee.email,
          church: attendee.church,
          phoneNumber: attendee.phoneNumber,
          identityCode: attendee.identityCode,
          status: attendee.status,
          registeredAt: attendee.registeredAt,
        },
        attendanceRecords: attendanceRecords.map((record: any) => ({
          id: record.id,
          checkedInAt: record.checkedInAt,
          method: record.method,
          eventName: record.eventName,
          quiz: record.quiz,
          checkedInBy: record.checkedInByAdmin,
        })),
        totalAttendance: attendanceRecords.length,
      });
    } catch (error) {
      console.error("Failed to fetch attendee attendance:", error);
      res.status(500).json({ message: "Failed to fetch attendee attendance" });
    }
  }
);

/**
 * @openapi
 * /admin/announcement:
 *   post:
 *     tags: [Admin]
 *     summary: Send announcement to all candidates
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/announcement",
  authenticate,
  authorizeAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { subject, message } = req.body;
      const adminId = req.user?.userId;

      // Get all candidates (users with role CANDIDATE)
      const candidates = await prisma.user.findMany({
        where: { role: "CANDIDATE" },
      });

      // Send emails
      for (const candidate of candidates) {
        await sendGeneralAnnouncementEmail(
          candidate.email,
          candidate.name,
          subject,
          message
        );
      }

      // Create notifications
      for (const candidate of candidates) {
        await prisma.notification.create({
          data: {
            type: "ANNOUNCEMENT",
            title: subject,
            message,
            userId: candidate.id,
            createdById: adminId,
          },
        });
      }

      // Emit to connected clients
      emitNotification("announcement", { title: subject, message });

      res.json({ message: "Announcement sent successfully" });

      await auditService.logFromRequest(
        req,
        "ANNOUNCEMENT_SENT",
        adminId,
        { subject, recipientCount: candidates.length }
      );
    } catch (error) {
      console.error("Failed to send announcement:", error);
      res.status(500).json({ message: "Failed to send announcement" });
    }
  }
);

/**
 * @openapi
 * /admin/candidates:
 *   get:
 *     tags: [Admin Candidates]
 *     summary: Get all candidates
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/candidates",
  authenticate,
  authorizeAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.userId;
      const adminRole = req.user?.role;
      const { search } = req.query;

      const where: any = { role: "CANDIDATE" };

      if (adminRole === "ADMIN") {
        where.uploadedById = adminId;
      }

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { email: { contains: search as string, mode: "insensitive" } },
        ];
      }

      const candidates = await prisma.user.findMany({
        where,
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
          sessions: {
            include: { quiz: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(candidates);
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
      res.status(500).json({ message: "Failed to fetch candidates" });
    }
  }
);

/**
 * @openapi
 * /admin/candidates/import:
 *   post:
 *     tags: [Admin Candidates]
 *     summary: Import candidates from Excel file
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               userType:
 *                 type: string
 */
router.post(
  "/candidates/import",
  authenticate,
  authorizeAdmin,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.userId;
      const { userType } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const imported: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        const name = row.Name || row.name || row["Full Name"];
        const email = row.Email || row.email;
        const church = row.Church || row.church || null;
        const association = row.Association || row.association || null;
        const importedUserType = row.UserType || row.userType || userType || UserType.AMBASSADOR_RANK_EXAMS;

        if (!name || !email) {
          errors.push({
            row: i + 2,
            message: "Name and email are required",
          });
          continue;
        }

        try {
          const existingUser = await prisma.user.findUnique({
            where: { email },
          });

          if (existingUser) {
            errors.push({
              row: i + 2,
              email,
              message: "User already exists",
            });
            continue;
          }

          const password = crypto.randomBytes(8).toString("hex");
          const hashedPassword = await bcrypt.hash(password, 10);
          const otp = generateOTP();
          const verifyUrl = `${process.env.WEB_URL || "http://localhost:3000"}/verify-email`;

          const user = await prisma.user.create({
            data: {
              name,
              email,
              password: hashedPassword,
              role: "CANDIDATE",
              userType: importedUserType,
              uploadedById: adminId,
              church,
              association,
              emailVerified: false,
              emailOtpHash: await bcrypt.hash(otp, 10),
              emailOtpExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
            },
          });

          imported.push({
            id: user.id,
            name,
            email,
            password,
            church,
            association,
            userType: importedUserType,
            verifyUrl,
            otp,
          });
        } catch (e) {
          errors.push({
            row: i + 2,
            email,
            message: "Failed to create user",
          });
        }
      }

      // Send welcome emails
      for (const candidate of imported) {
        try {
          await sendBulkWelcomeEmail(
            candidate.email,
            candidate.name,
            candidate.password,
            candidate.church || "N/A",
            candidate.association || "N/A",
            candidate.userType,
            candidate.verifyUrl,
            candidate.otp
          );
        } catch (e) {
          console.error(
            `Failed to send welcome email to ${candidate.email}:`,
            e
          );
        }
      }

      res.json({
        message: `Import completed: ${imported.length} imported, ${errors.length} errors`,
        imported,
        errors,
      });

      await auditService.logFromRequest(
        req,
        "CANDIDATES_IMPORTED",
        adminId,
        { importedCount: imported.length, errorCount: errors.length }
      );
    } catch (error) {
      console.error("Failed to import candidates:", error);
      res.status(500).json({ message: "Failed to import candidates" });
    }
  }
);

/**
 * @openapi
 * /admin/bulk-attendance-candidates:
 *   post:
 *     tags: [Admin Candidates]
 *     summary: Bulk import attendance candidates from Excel file (no password)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 */
router.post(
  "/bulk-attendance-candidates",
  authenticate,
  authorizeAdmin,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.user?.userId;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const imported: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        const name = row.Name || row.name || row["Full Name"] || row["Full Name"];
        const email = row.Email || row.email || row["Email Address"] || null;
        const church = row.Church || row.church || null;
        const phoneNumber = row.PhoneNumber || row.phoneNumber || row["Phone Number"] || row["Phone Number"] || null;

        if (!name) {
          errors.push({
            row: i + 2,
            message: "Name is required",
          });
          continue;
        }

        try {
          // Generate unique identity code
          const identityCode = QRService.generateAttendanceCode();

          // Create new attendee
          const attendee = await prisma.attendee.create({
            data: {
              fullName: name,
              email: email || null,
              church: church || null,
              phoneNumber: phoneNumber || null,
              identityCode,
              registeredById: adminId!,
            },
          });

          // Create permanent identity QR
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 100);
          const identityQR = await prisma.attendeeIdentityQR.create({
            data: {
              attendeeId: attendee.id,
              identityCode,
              expiresAt,
              isActive: true,
            },
          });

          const qrCode = await QRService.generateCandidateQRCode(identityCode, attendee.fullName);

          imported.push({
            id: attendee.id,
            fullName: attendee.fullName,
            email: attendee.email,
            church: attendee.church,
            phoneNumber: attendee.phoneNumber,
            identityCode,
            qrCode,
          });
        } catch (e) {
          errors.push({
            row: i + 2,
            name,
            message: "Failed to create attendee",
          });
        }
      }

      res.json({
        message: `Import completed: ${imported.length} imported, ${errors.length} errors`,
        success: imported.length,
        failed: errors.length,
        imported,
        errors,
      });

      await auditService.logFromRequest(
        req,
        "ATTENDANCE_CANDIDATES_BULK_IMPORTED",
        adminId,
        { importedCount: imported.length, errorCount: errors.length }
      );
    } catch (error) {
      console.error("Failed to import attendance candidates:", error);
      res.status(500).json({ message: "Failed to import attendance candidates" });
    }
  }
);

/**
 * @openapi
 * /admin/reports/attendance:
 *   get:
 *     tags: [Admin Reports]
 *     summary: Generate attendance report
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/reports/attendance",
  authenticate,
  authorizeAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, format } = req.query;

      let where: any = {};

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate as string);
        }
        if (endDate) {
          const end = new Date(endDate as string);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      const attendanceRecords = await prisma.manualAttendance.findMany({
        where,
        orderBy: { checkInTime: "desc" },
      });

      if (format === "xlsx") {
        const buffer = await ReportGenerator.attendanceToExcel(attendanceRecords);

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=attendance_report.xlsx"
        );
        return res.send(buffer);
      }

      res.json(attendanceRecords);
    } catch (error) {
      console.error("Failed to generate attendance report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  }
);

export default router;
