'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Clock, ChevronLeft, ChevronRight, Play, CheckCircle } from 'lucide-react';
import { publicQuizAPI, PublicQuizDetails, PublicQuizStartResponse, PublicQuizSubmitResponse } from '@/lib/api/publicQuiz';
import { useToast } from '@/contexts/ToastContext';

interface PublicQuizPlayerProps {
  quiz: PublicQuizDetails;
  playerName?: string;
  onComplete?: (result: PublicQuizSubmitResponse) => void;
  onCancel?: () => void;
}

export function PublicQuizPlayer({ quiz, playerName, onComplete, onCancel }: PublicQuizPlayerProps) {
  const [session, setSession] = useState<PublicQuizStartResponse | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PublicQuizSubmitResponse | null>(null);
  const { toast } = useToast();

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;

  useEffect(() => {
    startQuiz();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startQuiz = async () => {
    setLoading(true);
    try {
      const sessionData = await publicQuizAPI.startPublicQuiz({
        quizId: quiz.id,
        playerName: playerName || 'Anonymous Player'
      });
      setSession(sessionData);
      setStartTime(new Date());
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to start quiz', 'error');
      onCancel?.();
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const submitQuiz = async () => {
    if (!session) return;

    setSubmitting(true);
    try {
      const result = await publicQuizAPI.submitPublicQuiz({
        sessionId: session.sessionId,
        answers
      });
      setResult(result);
      onComplete?.(result);
      toast(`Quiz completed! Score: ${result.score}%`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to submit quiz', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTimeElapsed = () => {
    if (!startTime) return '0:00';
    const elapsed = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
    return formatTime(elapsed);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Quiz Completed!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-primary">{result.score}%</div>
              <div className="text-muted-foreground">
                {result.correctCount} out of {result.totalQuestions} questions correct
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-semibold text-green-600">{result.correctCount}</div>
                <div className="text-sm text-muted-foreground">Correct</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-red-600">{result.incorrectCount}</div>
                <div className="text-sm text-muted-foreground">Incorrect</div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold">{formatTime(result.timeTaken)}</div>
              <div className="text-sm text-muted-foreground">Time Taken</div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()} className="flex-1">
                Try Another Quiz
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{quiz.title}</CardTitle>
              <p className="text-muted-foreground">
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline">{getCategoryLabel(quiz.category)}</Badge>
              <div className="text-sm text-muted-foreground mt-1">
                <Clock className="h-4 w-4 inline mr-1" />
                {getTimeElapsed()}
              </div>
            </div>
          </div>
          <Progress value={progress} className="w-full" />
        </CardHeader>
      </Card>

      {/* Question */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {currentQuestion.text}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentQuestion.format === 'MULTIPLE_CHOICE' && currentQuestion.randomizedOptions ? (
            <RadioGroup>
              {currentQuestion.randomizedOptions.map((option) => (
                <div key={option.key} className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value={option.key} 
                    id={option.key}
                    checked={answers[currentQuestion.id] === option.key}
                    onChange={() => handleAnswerChange(currentQuestion.id, option.key)}
                  />
                  <Label htmlFor={option.key} className="flex-1 cursor-pointer">
                    {option.key}. {option.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : currentQuestion.format === 'FILL_IN_THE_GAP' ? (
            <div className="space-y-2">
              <Label htmlFor="fill-answer">Your Answer:</Label>
              <Input
                id="fill-answer"
                placeholder="Type your answer here..."
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              {Object.keys(answers).length} of {quiz.questions.length} answered
            </div>

            {currentQuestionIndex === quiz.questions.length - 1 ? (
              <Button
                onClick={submitQuiz}
                disabled={submitting || Object.keys(answers).length === 0}
              >
                {submitting ? (
                  <>Submitting...</>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit Quiz
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={goToNextQuestion}
                variant="default"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Answer Summary */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-3">Answer Summary</h3>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {quiz.questions.map((question, index) => {
              const isAnswered = answers[question.id];
              const isCurrent = index === currentQuestionIndex;
              return (
                <div
                  key={question.id}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                    ${isCurrent ? 'bg-primary text-primary-foreground' : 
                      isAnswered ? 'bg-green-100 text-green-800 border border-green-200' : 
                      'bg-muted text-muted-foreground'}
                  `}
                >
                  {index + 1}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getCategoryLabel(category: string) {
  switch (category) {
    case 'MCQ':
      return 'Multiple Choice';
    case 'FILL_IN_THE_GAP':
      return 'Fill in the Gap';
    default:
      return category;
  }
}
