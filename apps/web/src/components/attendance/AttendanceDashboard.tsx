'use client';

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  PlayCircle, 
  AlertCircle, 
  RefreshCw,
  UserCheck,
  Timer,
  FileCheck
} from 'lucide-react';
import { attendanceAPI, AttendanceDashboardResponse, AttendanceCandidate } from '@/lib/api/attendance';
import { useToast } from '@/contexts/ToastContext';

interface AttendanceDashboardProps {
  quizId: string;
  quizTitle: string;
}

export function AttendanceDashboard({ quizId, quizTitle }: AttendanceDashboardProps) {
  const [data, setData] = useState<AttendanceDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await attendanceAPI.getAttendanceDashboard(quizId);
      setData(response);
    } catch (error: any) {
      toast(error.message || 'Failed to load attendance data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [quizId]); // eslint-disable-line react-hooks/exhaustive-deps

  const getStatusBadge = (candidate: AttendanceCandidate) => {
    if (!candidate.examStatus) {
      return <Badge variant="secondary">Checked In Only</Badge>;
    }

    const { status, startedAt, submittedAt } = candidate.examStatus;
    
    if (submittedAt) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Submitted</Badge>;
    } else if (startedAt) {
      return <Badge variant="default" className="bg-blue-100 text-blue-800">In Progress</Badge>;
    } else {
      return <Badge variant="secondary">Checked In Only</Badge>;
    }
  };

  const getStatusIcon = (candidate: AttendanceCandidate) => {
    if (!candidate.examStatus) {
      return <UserCheck className="w-4 h-4 text-gray-500" />;
    }

    const { submittedAt, startedAt } = candidate.examStatus;
    
    if (submittedAt) {
      return <FileCheck className="w-4 h-4 text-green-600" />;
    } else if (startedAt) {
      return <Timer className="w-4 h-4 text-blue-600" />;
    } else {
      return <UserCheck className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDuration = (startedAt: string, submittedAt?: string) => {
    const start = new Date(startedAt);
    const end = submittedAt ? new Date(submittedAt) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000 / 60); // minutes
    
    if (duration < 60) {
      return `${duration}m`;
    } else {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading attendance data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load attendance data. Please try again.
          </AlertDescription>
        </Alert>
        <Button onClick={loadDashboard}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Candidates</p>
                <p className="text-2xl font-bold">{data.quiz.totalCandidates}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Checked In</p>
                <p className="text-2xl font-bold">{data.quiz.checkedInCount}</p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Started Exam</p>
                <p className="text-2xl font-bold">{data.quiz.startedExamCount}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                <p className="text-2xl font-bold">{data.quiz.submittedExamCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Candidates List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Candidate Attendance & Exam Status
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadDashboard}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {data.candidates.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No Candidates Checked In</h3>
              <p className="text-sm text-muted-foreground">
                Candidates will appear here once they are checked in using the QR scanner.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(candidate)}
                    <div>
                      <p className="font-medium">
                        {candidate.candidate.firstName} {candidate.candidate.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {candidate.candidate.email}
                      </p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Checked in: {new Date(candidate.checkedInAt).toLocaleString()}
                        </span>
                        {candidate.checkedInBy && (
                          <span className="text-xs text-muted-foreground">
                            by {candidate.checkedInBy.firstName} {candidate.checkedInBy.lastName}
                          </span>
                        )}
                        {candidate.examStatus?.startedAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <PlayCircle className="w-3 h-3" />
                            Started: {new Date(candidate.examStatus.startedAt).toLocaleString()}
                          </span>
                        )}
                        {candidate.examStatus?.submittedAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Submitted: {new Date(candidate.examStatus.submittedAt).toLocaleString()}
                          </span>
                        )}
                        {candidate.examStatus?.startedAt && (
                          <span className="text-xs text-muted-foreground">
                            Duration: {formatDuration(candidate.examStatus.startedAt, candidate.examStatus.submittedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {candidate.method}
                    </Badge>
                    {getStatusBadge(candidate)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <h4 className="font-medium">Status Legend:</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-gray-500" />
                <span>Checked In Only</span>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-600" />
                <span>Exam In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-green-600" />
                <span>Exam Submitted</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">QR_SCAN</Badge>
                <span>Check-in Method</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
