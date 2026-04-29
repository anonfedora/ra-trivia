'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Camera, CheckCircle, AlertCircle, Users, Clock } from 'lucide-react';
import { attendanceAPI, AdminScanRequest, AdminScanResponse } from '@/lib/api/attendance';
import { useToast } from '@/contexts/ToastContext';

interface AdminQRScannerProps {
  quizId: string;
  quizTitle: string;
  onScanSuccess?: (response: AdminScanResponse) => void;
}

export function AdminQRScanner({ quizId, quizTitle, onScanSuccess }: AdminQRScannerProps) {
  const [attendanceCode, setAttendanceCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<AdminScanResponse | null>(null);
  const { toast } = useToast();

  const handleScan = async () => {
    if (!attendanceCode.trim()) {
      toast('Please enter an attendance code', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await attendanceAPI.scanCandidateQR({
        attendanceCode: attendanceCode.trim(),
        quizId
      });
      
      setLastScanned(response);
      setAttendanceCode(''); // Clear input after successful scan
      toast(response.message, 'success');
      
      if (onScanSuccess) {
        onScanSuccess(response);
      }
    } catch (error: any) {
      toast(error.message || 'Failed to scan QR code', 'error');
      setLastScanned(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Candidate QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quiz Info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Exam:</span>
              <span className="text-sm">{quizTitle}</span>
            </div>
          </div>

          {/* Manual Input */}
          <div className="space-y-2">
            <Label htmlFor="attendance-code">Attendance Code (or scan QR)</Label>
            <div className="flex gap-2">
              <Input
                id="attendance-code"
                placeholder="Enter attendance code or scan QR"
                value={attendanceCode}
                onChange={(e) => setAttendanceCode(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                className="flex-1"
              />
              <Button 
                onClick={handleScan} 
                disabled={loading || !attendanceCode.trim()}
              >
                {loading ? 'Scanning...' : 'Check In'}
              </Button>
            </div>
          </div>

          {/* QR Scanner Note */}
          <Alert>
            <Camera className="h-4 w-4" />
            <AlertDescription>
              Ask candidates to show their QR code from their profile page. You can scan it with a QR scanner app or manually enter the attendance code shown on their screen.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Last Scanned Result */}
      {lastScanned && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Last Check-In
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Candidate</Label>
                <p className="font-medium">
                  {lastScanned.attendance.candidate.firstName} {lastScanned.attendance.candidate.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lastScanned.attendance.candidate.email}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Check-in Time</Label>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {new Date(lastScanned.attendance.checkedInAt).toLocaleString()}
                </p>
                <Badge variant="secondary" className="mt-1">
                  {lastScanned.attendance.method}
                </Badge>
              </div>
            </div>
            
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Candidate successfully checked in and can now start the exam.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">Check-in Process:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Ask candidates to open their profile and show their QR code</li>
              <li>Scan their QR code or manually enter the attendance code</li>
              <li>Verify the candidate information before confirming check-in</li>
              <li>Once checked in, candidates can access and start the exam</li>
              <li>Each QR code can only be used once per exam</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
