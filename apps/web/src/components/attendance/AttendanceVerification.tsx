'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { attendanceAPI, AttendanceVerifyResponse, PublicAttendanceInfo } from '@/lib/api/attendance';
import { useToast } from '@/contexts/ToastContext';

interface AttendanceVerificationProps {
  attendanceCode?: string;
  quizId?: string;
  onVerified?: (response: AttendanceVerifyResponse) => void;
}

export function AttendanceVerification({ attendanceCode, quizId, onVerified }: AttendanceVerificationProps) {
  const [code, setCode] = useState(attendanceCode || '');
  const [selectedQuizId, setSelectedQuizId] = useState(quizId || '');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<AttendanceVerifyResponse | null>(null);
  const [publicInfo, setPublicInfo] = useState<PublicAttendanceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const verifyAttendance = async () => {
    if (!code.trim()) {
      setError('Please enter an attendance code');
      return;
    }

    if (!selectedQuizId.trim()) {
      setError('Please enter a quiz ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await attendanceAPI.verifyAttendance({
        attendanceCode: code.trim(),
        quizId: selectedQuizId.trim()
      });

      setVerificationResult(response);
      onVerified?.(response);
      
      if (response.alreadyVerified) {
        toast('Attendance was already verified', 'info');
      } else {
        toast('Attendance verified successfully', 'success');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
      toast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPublicInfo = async (code: string) => {
    try {
      const info = await attendanceAPI.getPublicAttendanceInfo(code);
      setPublicInfo(info);
      setSelectedQuizId(info.quizId);
      setError(null);
    } catch (error) {
      setPublicInfo(null);
      // Don't show error for public info loading failure
    }
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    setError(null);
    
    // Auto-load public info when code is entered
    if (value.length >= 8) {
      loadPublicInfo(value);
    } else {
      setPublicInfo(null);
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString();
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Attendance Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Public Info Display */}
          {publicInfo && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div><strong>Quiz:</strong> {publicInfo.quizTitle}</div>
                  <div><strong>Duration:</strong> {publicInfo.duration} minutes</div>
                  <div><strong>Expires:</strong> {formatTime(publicInfo.expiresAt)}</div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Input Fields */}
          <div className="space-y-2">
            <Label htmlFor="attendanceCode">Attendance Code</Label>
            <Input
              id="attendanceCode"
              placeholder="Enter attendance code from QR or link"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quizId">Quiz ID</Label>
            <Input
              id="quizId"
              placeholder="Enter quiz ID"
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
              disabled={loading || !!publicInfo}
            />
            {publicInfo && (
              <p className="text-sm text-muted-foreground">
                Quiz ID auto-loaded from attendance code
              </p>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Verification Result */}
          {verificationResult && (
            <Alert className={verificationResult.alreadyVerified ? "border-blue-200" : "border-green-200"}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">
                    {verificationResult.alreadyVerified ? 'Attendance Already Verified' : 'Attendance Verified Successfully'}
                  </div>
                  <div className="text-sm space-y-1">
                    <div><strong>Quiz:</strong> {verificationResult.quizTitle}</div>
                    <div><strong>Method:</strong> {verificationResult.method.replace('_', ' ')}</div>
                    <div><strong>Time:</strong> {formatTime(verificationResult.verifiedAt)}</div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Button */}
          <Button 
            onClick={verifyAttendance} 
            disabled={loading || !code.trim() || !selectedQuizId.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Verify Attendance
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">How to verify attendance:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Scan the QR code provided by your admin</li>
              <li>Or click the attendance link sent to you</li>
              <li>Or manually enter the attendance code above</li>
              <li>Make sure you&apos;re logged into your account</li>
              <li>Click &quot;Verify Attendance&quot; to complete</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
