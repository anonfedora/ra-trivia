'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Copy, RefreshCw, Clock, Users, ArrowRight } from 'lucide-react';
import { attendanceAPI, QRGenerateResponse, QRStatusResponse } from '@/lib/api/attendance';
import { useToast } from '@/contexts/ToastContext';
import Link from 'next/link';

interface QRCodeDisplayProps {
  quizId: string;
  quizTitle: string;
  onStatusChange?: (status: QRStatusResponse) => void;
}

export function QRCodeDisplay({ quizId, quizTitle, onStatusChange }: QRCodeDisplayProps) {
  const [qrData, setQrData] = useState<QRGenerateResponse | null>(null);
  const [status, setStatus] = useState<QRStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadStatus = async () => {
    try {
      const statusData = await attendanceAPI.getQRStatus(quizId);
      setStatus(statusData);
      onStatusChange?.(statusData);
    } catch (error) {
      console.error('Failed to load QR status:', error);
    }
  };

  const generateQR = async (expiresHours: number = 2) => {
    setLoading(true);
    try {
      const data = await attendanceAPI.generateQRCode({ quizId, expiresHours });
      setQrData(data);
      await loadStatus(); // Refresh status after generation
      toast('QR code generated successfully', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to generate QR code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const disableQR = async () => {
    setLoading(true);
    try {
      await attendanceAPI.disableQRAttendance(quizId);
      setQrData(null);
      await loadStatus();
      toast('QR attendance disabled', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to disable QR attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyAttendanceLink = () => {
    if (qrData?.attendanceLink) {
      navigator.clipboard.writeText(qrData.attendanceLink);
      toast('Attendance link copied to clipboard', 'success');
    }
  };

  const copyAttendanceCode = () => {
    if (qrData?.attendanceCode) {
      navigator.clipboard.writeText(qrData.attendanceCode);
      toast('Attendance code copied to clipboard', 'success');
    }
  };

  const formatExpirationTime = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Load initial status
  useState(() => {
    loadStatus();
  });

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            QR Attendance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={status.enableQRAttendance ? 'default' : 'secondary'}>
                  {status.enableQRAttendance ? 'Enabled' : 'Disabled'}
                </Badge>
                {status.enableQRAttendance && (
                  <Badge variant={status.hasValidQR ? 'default' : 'outline'}>
                    {status.hasValidQR ? 'Active' : 'Inactive'}
                  </Badge>
                )}
              </div>
              
              {status.enableQRAttendance && status.expiresAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Expires in: {formatExpirationTime(status.expiresAt)}
                  {status.needsRefresh && (
                    <Badge variant="outline" className="ml-2">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Needs Refresh
                    </Badge>
                  )}
                </div>
              )}

              {status.attendanceCode && (
                <div className="text-sm">
                  <span className="font-medium">Attendance Code:</span>
                  <code className="ml-2 px-2 py-1 bg-muted rounded">{status.attendanceCode}</code>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Display */}
      {qrData && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg border">
                <QRCodeSVG
                  value={qrData.attendanceLink}
                  size={256}
                  level="M"
                  includeMargin={true}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Attendance Link:</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 px-2 py-1 bg-muted rounded text-xs break-all">
                    {qrData.attendanceLink}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyAttendanceLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="text-sm">
                <span className="font-medium">Attendance Code:</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 px-2 py-1 bg-muted rounded text-center">
                    {qrData.attendanceCode}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyAttendanceCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* New Attendance Management */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                <strong>Updated Process:</strong> Admins now scan candidate QR codes instead of candidates scanning admin QR codes.
              </p>
              <Link href={`/admin/quizzes/${quizId}/attendance`}>
                <Button variant="outline" size="sm" className="bg-white">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Attendance
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
            
            {/* Legacy QR Generation */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>Legacy QR Generation:</strong> (No longer recommended - use Manage Attendance above)
              </p>
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={() => generateQR(2)} 
                  disabled={loading}
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate QR (2h)
                </Button>
                
                <Button 
                  onClick={() => generateQR(4)} 
                  disabled={loading}
                  variant="outline"
                >
                  Generate QR (4h)
                </Button>
                
                <Button 
                  onClick={() => generateQR(8)} 
                  disabled={loading}
                  variant="outline"
                >
                  Generate QR (8h)
                </Button>
                
                {status?.enableQRAttendance && (
                  <Button 
                    onClick={disableQR} 
                    disabled={loading}
                    variant="destructive"
                  >
                    Disable QR
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
