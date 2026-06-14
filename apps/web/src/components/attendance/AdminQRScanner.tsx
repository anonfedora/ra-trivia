'use client';

import { useState, useCallback } from 'react';
import { Scanner, useDevices } from '@yudiel/react-qr-scanner';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Camera, CheckCircle, AlertCircle, Users, Clock, QrCode } from 'lucide-react';
import { attendanceAPI, AdminScanRequest, AdminScanResponse } from '@/lib/api/attendance';
import { useToast } from '@/contexts/ToastContext';

interface AdminQRScannerProps {
  quizId?: string;
  quizTitle?: string;
  onScanSuccess?: (response: AdminScanResponse) => void;
}

export function AdminQRScanner({ quizId, quizTitle, onScanSuccess }: AdminQRScannerProps) {
  const [attendanceCode, setAttendanceCode] = useState('');
  const [eventName, setEventName] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<AdminScanResponse | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const devices = useDevices();
  const { toast } = useToast();

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) {
      toast('No QR code detected', 'warning');
      return;
    }
    setAttendanceCode(code.trim());
    setIsScannerActive(false); // Deactivate scanner after a successful scan or manual input

    if (!quizId && !eventName.trim()) {
      toast('Please enter an event name', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await attendanceAPI.scanCandidateQR({
        attendanceCode: code.trim(),
        quizId,
        eventName: eventName.trim() || undefined
      });
      
      setLastScanned(response);
      toast(response.message, 'success');
      
      if (onScanSuccess) {
        onScanSuccess?.(response);
      }
    } catch (error: any) {
      toast(error.message || 'Failed to scan QR code', 'error');
      setLastScanned(null);
    } finally {
      setLoading(false);
    }
  }, [quizId, eventName, toast, onScanSuccess]);

  const handleManualScan = async () => {
    await handleScan(attendanceCode);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualScan();
    }
  };

  const handleScannerScan = (result: any) => {
    if (result && result[0] && result[0].rawValue) {
      try {
        const parsedData = JSON.parse(result[0].rawValue);
        if (parsedData.identityCode) {
          handleScan(parsedData.identityCode);
        } else {
          toast('Invalid QR code format', 'error');
        }
      } catch (error) {
        toast('Failed to parse QR code data', 'error');
      }
    }
  };

  const handleScannerError = (error: any) => {
    if (error.name !== 'NotAllowedError' && error.name !== 'NotFoundError') {
      console.error('QR Scanner Error:', error);
      toast(`Scanner error: ${error.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Identity QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quiz/Event Info */}
          {quizTitle ? (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Exam:</span>
                <span className="text-sm">{quizTitle}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="event-name">Event Name *</Label>
              <Input
                id="event-name"
                placeholder="Enter event name (e.g. Sunday Service, Seminar)"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {/* Manual Input */}
          <div className="space-y-2">
            <Label htmlFor="attendance-code">Identity Code (or scan QR)</Label>
            <div className="flex gap-2">
              <Input
                id="attendance-code"
                placeholder="Enter code or scan QR"
                value={attendanceCode}
                onChange={(e) => setAttendanceCode(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                className="flex-1 font-mono tracking-widest"
              />
              <Button 
                onClick={handleManualScan} 
                disabled={loading || !attendanceCode.trim() || (!quizId && !eventName.trim())}
                className="bg-primary hover:bg-primary/90"
              >
                {loading ? 'Scanning...' : 'Check In'}
              </Button>
            </div>
          </div>

          {/* QR Scanner Toggle and Display */}
          <div className="space-y-2">
            <Button 
              onClick={() => setIsScannerActive(prev => !prev)}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              {isScannerActive ? <QrCode className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {isScannerActive ? 'Close Camera Scanner' : 'Open Camera Scanner'}
            </Button>

            {isScannerActive && (
              <div className="relative w-full h-64 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden flex items-center justify-center">
                {devices.length > 0 && (
                  <select
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="absolute top-2 left-2 z-10 bg-white dark:bg-slate-800 text-sm p-1 rounded-md"
                  >
                    {devices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId}`}
                      </option>
                    ))}
                  </select>
                )}
                <Scanner
                  onScan={handleScannerScan}
                  onError={handleScannerError}
                  constraints={selectedDeviceId ? { deviceId: selectedDeviceId } : { facingMode: 'environment' }}
                  styles={{
                    container: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
                    video: { width: '100%', height: '100%', objectFit: 'cover' },
                  }}
                />
              </div>
            )}

            {!isScannerActive && (
              <Alert className="bg-blue-50 border-blue-200">
                <Camera className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Scan the QR code on the candidate&apos;s ID card or enter the unique identity code shown below their name.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Last Scanned Result */}
      {lastScanned && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              Check-In Successful
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground uppercase tracking-wider">Candidate</Label>
                <p className="font-bold text-lg text-slate-900">
                  {lastScanned.attendance.candidate.name}
                </p>
                <p className="text-sm text-slate-500">
                  {lastScanned.attendance.candidate.email}
                </p>
                {lastScanned.attendance.candidate.church && (
                  <p className="text-xs text-slate-400 mt-1">
                    {lastScanned.attendance.candidate.church}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-sm text-muted-foreground uppercase tracking-wider">Time &amp; Method</Label>
                <p className="font-medium flex items-center gap-1 text-slate-700">
                  <Clock className="w-4 h-4" />
                  {new Date(lastScanned.attendance.checkedInAt).toLocaleTimeString()}
                </p>
                <Badge variant="secondary" className="mt-1 bg-white border-slate-200">
                  {lastScanned.attendance.method}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">Check-in Process:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Enter the event name if not already set.</li>
              <li>Scan the candidate&apos;s QR code or enter their ID code manually.</li>
              <li>Verify the candidate&apos;s name and details on screen.</li>
              <li>A success message will appear after recording the attendance.</li>
              <li>Each candidate can only be checked in once per event.</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
