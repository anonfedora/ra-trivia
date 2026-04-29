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

export interface CandidateQRResponse {
  attendanceCode: string;
  attendanceLink: string;
  expiresAt: string;
  qrData: string;
}

export interface AdminScanRequest {
  attendanceCode: string;
  quizId: string;
}

export interface AdminScanResponse {
  message: string;
  attendance: {
    id: string;
    candidate: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    checkedInAt: string;
    method: string;
  };
}

export interface AttendanceCandidate {
  id: string;
  candidate: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  checkedInAt: string;
  checkedInBy?: {
    firstName: string;
    lastName: string;
  };
  method: string;
  examStatus: {
    sessionId: string;
    startedAt: string;
    submittedAt?: string;
    status: string;
  } | null;
}

export interface AttendanceDashboardResponse {
  quiz: {
    id: string;
    title: string;
    totalCandidates: number;
    checkedInCount: number;
    startedExamCount: number;
    submittedExamCount: number;
  };
  candidates: AttendanceCandidate[];
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

  async generateCandidateQR(): Promise<CandidateQRResponse> {
    const response = await fetch(`${API_BASE}/attendance/qr/candidate`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate candidate QR code');
    }

    return response.json();
  }

  async scanCandidateQR(data: AdminScanRequest): Promise<AdminScanResponse> {
    const response = await fetch(`${API_BASE}/attendance/qr/scan`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to scan candidate QR code');
    }

    return response.json();
  }

  async getAttendanceDashboard(quizId: string): Promise<AttendanceDashboardResponse> {
    const response = await fetch(`${API_BASE}/attendance/quiz/${quizId}/candidates`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get attendance records');
    }

    return response.json();
  }
}

export const attendanceAPI = new AttendanceAPI();
