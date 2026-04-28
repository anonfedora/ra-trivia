import { getAccessToken } from '../auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface QRGenerateRequest {
  quizId: string;
  expiresHours?: number;
}

export interface QRGenerateResponse {
  message: string;
  qrCode: string;
  attendanceLink: string;
  attendanceCode: string;
  expiresAt: string;
  enableQRAttendance: boolean;
}

export interface QRStatusResponse {
  quizId: string;
  quizTitle: string;
  enableQRAttendance: boolean;
  hasValidQR: boolean;
  needsRefresh: boolean;
  expiresAt: string | null;
  attendanceCode: string | null;
}

export interface AttendanceVerifyRequest {
  attendanceCode: string;
  quizId: string;
}

export interface AttendanceVerifyResponse {
  message: string;
  verifiedAt: string;
  method: string;
  quizTitle: string;
  alreadyVerified?: boolean;
}

export interface PublicAttendanceInfo {
  quizId: string;
  quizTitle: string;
  duration: number;
  expiresAt: string;
  valid: boolean;
}

class AttendanceAPI {
  private getAuthHeaders() {
    const token = getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async generateQRCode(data: QRGenerateRequest): Promise<QRGenerateResponse> {
    const response = await fetch(`${API_BASE}/attendance/qr/generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate QR code');
    }

    return response.json();
  }

  async getQRStatus(quizId: string): Promise<QRStatusResponse> {
    const response = await fetch(`${API_BASE}/attendance/qr/status/${quizId}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get QR status');
    }

    return response.json();
  }

  async disableQRAttendance(quizId: string): Promise<{ message: string; enableQRAttendance: boolean }> {
    const response = await fetch(`${API_BASE}/attendance/qr/disable`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ quizId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to disable QR attendance');
    }

    return response.json();
  }

  async verifyAttendance(data: AttendanceVerifyRequest): Promise<AttendanceVerifyResponse> {
    const response = await fetch(`${API_BASE}/attendance/verify`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify attendance');
    }

    return response.json();
  }

  async getPublicAttendanceInfo(attendanceCode: string): Promise<PublicAttendanceInfo> {
    const response = await fetch(`${API_BASE}/attendance/public/${attendanceCode}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Invalid or expired attendance code');
    }

    return response.json();
  }
}

export const attendanceAPI = new AttendanceAPI();
