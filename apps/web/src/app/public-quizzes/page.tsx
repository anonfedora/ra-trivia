'use client';

import { useState } from 'react';
import { PublicQuizList } from '@/components/public-quiz/PublicQuizList';
import { PublicQuizPlayer } from '@/components/public-quiz/PublicQuizPlayer';
import { publicQuizAPI, PublicQuiz, PublicQuizDetails } from '@/lib/api/publicQuiz';
import { useToast } from '@/contexts/ToastContext';

export default function PublicQuizzesPage() {
  const [selectedQuiz, setSelectedQuiz] = useState<PublicQuizDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleStartQuiz = async (quiz: PublicQuiz) => {
    setLoading(true);
    try {
      const quizDetails = await publicQuizAPI.getPublicQuizDetails(quiz.id);
      setSelectedQuiz(quizDetails);
    } catch (error) {
      toast('Failed to load quiz details', 'error');
      console.error('Failed to load quiz details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuizComplete = (result: any) => {
    // Could show a completion modal or redirect to results
    console.log('Quiz completed:', result);
  };

  const handleCancelQuiz = () => {
    setSelectedQuiz(null);
  };

  if (selectedQuiz) {
    return (
      <div className="container mx-auto py-8">
        <PublicQuizPlayer
          quiz={selectedQuiz}
          onComplete={handleQuizComplete}
          onCancel={handleCancelQuiz}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <PublicQuizList onStartQuiz={handleStartQuiz} />
    </div>
  );
}
