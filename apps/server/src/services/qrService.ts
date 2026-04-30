import crypto from 'crypto';
import QRCode from 'qrcode';

export interface QRAttendanceData {
  quizId: string;
  attendanceCode: string;
  expiresAt: string;
  quizTitle: string;
}

export class QRService {
  /**
   * Generate a unique attendance code for QR/link access
   */
  static generateAttendanceCode(): string {
    // Generate 5-character code with numbers and capital letters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate QR code data URL for attendance
   */
  static async generateQRCode(attendanceData: QRAttendanceData): Promise<string> {
    const baseUrl = process.env.WEB_URL || 'http://localhost:3000';
    const attendanceUrl = `${baseUrl}/attendance/${attendanceData.attendanceCode}`;
    
    try {
      const qrDataUrl = await QRCode.toDataURL(attendanceUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      return qrDataUrl;
    } catch (error) {
      console.error('[QR_SERVICE] Failed to generate QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate attendance link (URL) for sharing
   */
  static generateAttendanceLink(attendanceCode: string): string {
    const baseUrl = process.env.WEB_URL || 'http://localhost:3000';
    return `${baseUrl}/attendance/${attendanceCode}`;
  }

  /**
   * Verify attendance code is valid and not expired
   */
  static verifyAttendanceCode(quiz: any, providedCode: string): boolean {
    if (!quiz.enableQRAttendance || !quiz.qrAttendanceCode || !quiz.qrCodeExpiresAt) {
      return false;
    }

    // Check if the provided code matches
    if (quiz.qrAttendanceCode !== providedCode.toUpperCase()) {
      return false;
    }

    // Check if the code hasn't expired
    const now = new Date();
    const expiresAt = new Date(quiz.qrCodeExpiresAt);
    
    return now < expiresAt;
  }

  /**
   * Create attendance data for QR generation
   */
  static createAttendanceData(quiz: any): QRAttendanceData {
    return {
      quizId: quiz.id,
      attendanceCode: quiz.qrAttendanceCode || '',
      expiresAt: quiz.qrCodeExpiresAt?.toISOString() || '',
      quizTitle: quiz.title
    };
  }

  /**
   * Generate QR code expiration time (default 2 hours from now)
   */
  static generateExpirationTime(hours: number = 2): Date {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  /**
   * Check if QR code needs refresh (expired or will expire within 30 minutes)
   */
  static needsRefresh(qrCodeExpiresAt: Date | null | undefined): boolean {
    if (!qrCodeExpiresAt) {
      return true;
    }

    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    
    return new Date(qrCodeExpiresAt) < thirtyMinutesFromNow;
  }
}
