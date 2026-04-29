'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Camera, Users, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { AdminQRScanner } from '@/components/attendance/AdminQRScanner';
import { AttendanceDashboard } from '@/components/attendance/AttendanceDashboard';
import { AdminScanResponse } from '@/lib/api/attendance';
import { useToast } from '@/contexts/ToastContext';

export default function QuizAttendancePage() {
  const params = useParams();
  const quizId = params?.id as string;
  const [quizTitle, setQuizTitle] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  // Load quiz title
  useEffect(() => {
    const loadQuizTitle = async () => {
      try {
        const response = await fetch(`/api/quizzes/${quizId}`);
        if (response.ok) {
          const quiz = await response.json();
          setQuizTitle(quiz.title);
        }
      } catch (error) {
        console.error('Failed to load quiz title:', error);
      }
    };

    if (quizId) {
      loadQuizTitle();
    }
  }, [quizId]);

  const handleScanSuccess = (response: AdminScanResponse) => {
    // Refresh the dashboard when a new candidate is scanned
    setRefreshKey(prev => prev + 1);
  };

  if (!quizId) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Quiz Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The quiz you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to access it.
          </p>
          <Link href="/admin/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/admin/quizzes/${quizId}/preview`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Preview
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Attendance Management</h1>
              <p className="text-muted-foreground">
                {quizTitle || 'Loading...'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            Quiz ID: {quizId.slice(0, 8)}...
          </Badge>
        </div>

        {/* Instructions */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm text-muted-foreground">
              <h4 className="font-medium text-foreground">Attendance Process:</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Candidates generate their personal QR codes from their profile page</li>
                <li>Use the QR Scanner to scan candidate QR codes for check-in</li>
                <li>Monitor attendance and exam progress in the Dashboard</li>
                <li>Only checked-in candidates can start and submit the exam</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="scanner" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scanner" className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              QR Scanner
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Attendance Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scanner" className="space-y-6">
            <AdminQRScanner
              quizId={quizId}
              quizTitle={quizTitle}
              onScanSuccess={handleScanSuccess}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <AttendanceDashboard
              key={refreshKey} // Force re-render when refreshKey changes
              quizId={quizId}
              quizTitle={quizTitle}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
