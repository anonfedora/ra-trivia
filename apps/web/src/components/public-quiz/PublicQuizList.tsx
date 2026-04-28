'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Clock, Users, Play, Search } from 'lucide-react';
import { publicQuizAPI, PublicQuiz } from '@/lib/api/publicQuiz';
import { useToast } from '@/contexts/ToastContext';

interface PublicQuizListProps {
  onStartQuiz?: (quiz: PublicQuiz) => void;
}

export function PublicQuizList({ onStartQuiz }: PublicQuizListProps) {
  const [quizzes, setQuizzes] = useState<PublicQuiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<PublicQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MCQ' | 'FILL_IN_THE_GAP'>('ALL');
  const { toast } = useToast();

  useEffect(() => {
    loadQuizzes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let filtered = quizzes;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(quiz =>
        quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quiz.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter(quiz => quiz.category === categoryFilter);
    }

    setFilteredQuizzes(filtered);
  }, [quizzes, searchTerm, categoryFilter]);

  const loadQuizzes = async () => {
    try {
      const data = await publicQuizAPI.getPublicQuizzes();
      setQuizzes(data);
    } catch (error) {
      toast('Failed to load public quizzes', 'error');
      console.error('Failed to load quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'MCQ':
        return 'default';
      case 'FILL_IN_THE_GAP':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'MCQ':
        return 'Multiple Choice';
      case 'FILL_IN_THE_GAP':
        return 'Fill in the Gap';
      default:
        return category;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Public Quizzes</h1>
        <p className="text-muted-foreground">
          Try our sample quizzes to test your knowledge!
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search quizzes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={categoryFilter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter('ALL')}
              >
                All
              </Button>
              <Button
                variant={categoryFilter === 'MCQ' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter('MCQ')}
              >
                Multiple Choice
              </Button>
              <Button
                variant={categoryFilter === 'FILL_IN_THE_GAP' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter('FILL_IN_THE_GAP')}
              >
                Fill in Gap
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiz Grid */}
      {filteredQuizzes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-muted-foreground">
              {searchTerm || categoryFilter !== 'ALL' 
                ? 'No quizzes found matching your filters.'
                : 'No public quizzes available at the moment.'
              }
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuizzes.map((quiz) => (
            <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">{quiz.title}</CardTitle>
                  <Badge variant={getCategoryColor(quiz.category)}>
                    {getCategoryLabel(quiz.category)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {quiz.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {quiz.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{quiz._count.questions} questions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{quiz._count.attempts} attempts</span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Created: {formatDate(quiz.createdAt)}
                </div>

                <Button 
                  onClick={() => onStartQuiz?.(quiz)}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Quiz
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
