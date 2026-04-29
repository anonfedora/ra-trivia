'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Copy, RefreshCw, Clock, User } from 'lucide-react';
import { attendanceAPI, CandidateQRResponse } from '@/lib/api/attendance';
import { useToast } from '@/contexts/ToastContext';

export function CandidateQRCode() {
  const [qrData, setQrData] = useState<CandidateQRResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateQR = async () => {
    setLoading(true);
    try {
      const data = await attendanceAPI.generateCandidateQR();
      setQrData(data);
      toast('QR code generated successfully', 'success');
    } catch (error: any) {
      toast(error.message || 'Failed to generate QR code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyAttendanceCode = () => {
    if (qrData?.attendanceCode) {
      navigator.clipboard.writeText(qrData.attendanceCode);
      toast('Attendance code copied to clipboard', 'success');
    }
  };

  const copyAttendanceLink = () => {
    if (qrData?.attendanceLink) {
      navigator.clipboard.writeText(qrData.attendanceLink);
      toast('Attendance link copied to clipboard', 'success');
    }
  };

  useEffect(() => {
    generateQR();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isExpired = qrData ? new Date(qrData.expiresAt) < new Date() : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Your Attendance QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrData && !isExpired ? (
            <>
              {/* QR Code Display */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg border">
                  <QRCodeSVG
                    value={qrData.qrData}
                    size={256}
                    level="M"
                    includeMargin={true}
                  />
                </div>
              </div>
              
              {/* Status and Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Expires:</span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {new Date(qrData.expiresAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Attendance Code */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Attendance Code:</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-muted rounded font-mono text-sm">
                    {qrData.attendanceCode}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAttendanceCode}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Attendance Link */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Attendance Link:</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-muted rounded text-xs truncate">
                    {qrData.attendanceLink}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAttendanceLink}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={generateQR}
                  disabled={loading}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {loading ? 'Generating...' : 'Generate New QR'}
                </Button>
              </div>
            </>
          ) : isExpired ? (
            <div className="text-center space-y-4">
              <Badge variant="destructive">QR Code Expired</Badge>
              <p className="text-sm text-muted-foreground">
                Your QR code has expired. Please generate a new one.
              </p>
              <Button onClick={generateQR} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {loading ? 'Generating...' : 'Generate New QR'}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">
                Generating your QR code...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">How to use this QR code:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Show this QR code to the exam administrator</li>
              <li>The admin will scan your QR code to mark you as present</li>
              <li>Once checked in, you can start your exam</li>
              <li>This QR code expires in 24 hours for security</li>
              <li>Generate a new QR code if yours expires</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
