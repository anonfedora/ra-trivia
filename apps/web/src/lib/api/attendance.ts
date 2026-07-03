import { apiFetch } from "../api";

// Use apiFetch for consistent auth handling and token refresh

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
  quizId?: string;
  eventName?: string;
}

export interface AdminScanResponse {
  message: string;
  attendance: {
    id: string;
    candidate: {
      id: string;
      email?: string;
      name: string;
      church?: string;
      isAttendee?: boolean;
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

export interface CandidateRegisterRequest {
  name: string;
  email?: string;
  church?: string;
  phoneNumber?: string;
}

export interface CandidateRegisterResponse {
  message: string;
  candidate: {
    id: string;
    fullName: string;
    email?: string;
    church?: string;
    phoneNumber?: string;
  };
  qrCode: string;
  identityCode: string;
}

export interface CandidateIdentity {
  id: string;
  fullName: string;
  email?: string;
  church?: string;
  phoneNumber?: string;
  identityCode: string;
  qrCode: string;
}

export interface AttendanceRecord {
  id: string;
  fullName: string;
  email?: string | null;
  church?: string | null;
  checkInTime: string;
  method: string;
  checkedInBy: string;
  eventName?: string | null;
  quizId?: string | null;
  type: "QR_SCAN" | "MANUAL";
}

export interface AttendanceRecordsResponse {
  attendanceRecords: AttendanceRecord[];
}

export interface ManualAttendanceRequest {
  fullName: string;
  church?: string;
  checkInTime?: string;
  method?: string;
  checkedInBy?: string;
  eventName?: string;
  notes?: string;
}

export interface ManualAttendanceResponse {
  message: string;
  attendance: {
    id: string;
    fullName: string;
    church?: string;
    checkInTime: string;
    method: string;
    checkedInBy?: string;
    eventName?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ManualAttendanceListResponse {
  attendanceRecords: ManualAttendanceResponse['attendance'][];
}

class AttendanceAPI {
  async generateQRCode(data: QRGenerateRequest): Promise<QRGenerateResponse> {
    const response = await apiFetch('/attendance/qr/generate', {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to generate QR code");
    }

    return response.json();
  }

  async getQRStatus(quizId: string): Promise<QRStatusResponse> {
    const response = await apiFetch(`/attendance/qr/status/${quizId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get QR status");
    }

    return response.json();
  }

  async disableQRAttendance(quizId: string): Promise<{ message: string; enableQRAttendance: boolean }> {
    const response = await apiFetch('/attendance/qr/disable', {
      method: "POST",
      body: JSON.stringify({ quizId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to disable QR attendance");
    }

    return response.json();
  }

  async verifyAttendance(data: AttendanceVerifyRequest): Promise<AttendanceVerifyResponse> {
    const response = await apiFetch('/attendance/verify', {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to verify attendance");
    }

    return response.json();
  }

  async getPublicAttendanceInfo(attendanceCode: string): Promise<PublicAttendanceInfo> {
    const response = await apiFetch(`/attendance/public/${attendanceCode}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Invalid or expired attendance code");
    }

    return response.json();
  }

  async generateCandidateQR(): Promise<CandidateQRResponse> {
    const response = await apiFetch('/attendance/qr/candidate');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to generate candidate QR code");
    }

    return response.json();
  }

  async scanCandidateQR(data: AdminScanRequest): Promise<AdminScanResponse> {
    const response = await apiFetch('/attendance/qr/scan', {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to scan candidate QR code");
    }

    return response.json();
  }

  async getAttendanceDashboard(quizId: string): Promise<AttendanceDashboardResponse> {
    const response = await apiFetch(`/attendance/quiz/${quizId}/candidates`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get attendance records");
    }

    return response.json();
  }

  async createManualAttendance(data: ManualAttendanceRequest): Promise<ManualAttendanceResponse> {
    const response = await apiFetch('/attendance/manual', {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to record manual attendance");
    }

    return response.json();
  }

  async recordManualAttendance(data: ManualAttendanceRequest): Promise<ManualAttendanceResponse> {
    return this.createManualAttendance(data);
  }

  async getManualAttendanceRecords(params?: {
    startDate?: string;
    endDate?: string;
    church?: string;
    eventName?: string;
  }): Promise<ManualAttendanceListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    if (params?.church) searchParams.set("church", params.church);
    if (params?.eventName) searchParams.set("eventName", params.eventName);

    const url = `/attendance/manual${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const response = await apiFetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch manual attendance");
    }

    return response.json();
  }

  async deleteManualAttendance(id: string): Promise<{ message: string }> {
    const response = await apiFetch(`/attendance/manual/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete attendance");
    }

    return response.json();
  }

  async registerCandidate(data: CandidateRegisterRequest): Promise<CandidateRegisterResponse> {
    const response = await apiFetch('/admin/register-candidate', {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to register candidate");
    }

    return response.json();
  }

  async getCandidateIdentities(): Promise<CandidateIdentity[]> {
    const response = await apiFetch('/admin/candidates/identities');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch candidate identities");
    }

    return response.json();
  }

  async getAttendanceRecords(params?: {
    startDate?: string;
    endDate?: string;
    church?: string;
    eventName?: string;
  }): Promise<AttendanceRecordsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    if (params?.church) searchParams.set("church", params.church);
    if (params?.eventName) searchParams.set("eventName", params.eventName);

    const url = `/attendance/records${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;
    const response = await apiFetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch attendance records");
    }

    return response.json();
  }
}

export const attendanceAPI = new AttendanceAPI();
