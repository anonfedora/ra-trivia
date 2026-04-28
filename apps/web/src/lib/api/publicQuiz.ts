const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface PublicQuiz {
  id: string;
  title: string;
  description?: string;
  category: 'MCQ' | 'FILL_IN_THE_GAP';
  createdAt: string;
  _count: {
    questions: number;
    attempts: number;
  };
}

export interface PublicQuizDetails extends PublicQuiz {
  questions: PublicQuestion[];
}

export interface PublicQuestion {
  id: string;
  text: string;
  format: 'MULTIPLE_CHOICE' | 'FILL_IN_THE_GAP';
  randomizedOptions?: Array<{
    originalKey: string;
    key: string;
    text: string;
  }>;
}

export interface PublicQuizStartRequest {
  quizId: string;
  playerName?: string;
}

export interface PublicQuizStartResponse {
  sessionId: string;
  playerName: string;
  startTime: string;
  quiz: {
    id: string;
    title: string;
    category: string;
    description?: string;
  };
}

export interface PublicQuizSubmitRequest {
  sessionId: string;
  answers: Record<string, string>;
}

export interface PublicQuizSubmitResponse {
  sessionId: string;
  playerName: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  timeTaken: number;
  startTime: string;
  endTime: string;
  questionResults: QuestionResult[];
  quiz: {
    id: string;
    title: string;
    category: string;
  };
}

export interface QuestionResult {
  questionId: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface PublicQuizResults {
  sessionId: string;
  playerName: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  timeTaken: number;
  startTime: string;
  endTime: string;
  quiz: {
    id: string;
    title: string;
    category: string;
  };
  questionResults: QuestionResult[];
}

export interface LeaderboardEntry {
  rank: number;
  sessionId: string;
  playerName: string;
  score: number;
  timeTaken: number;
  completedAt: string;
}

export interface LeaderboardResponse {
  quizId: string;
  quizTitle: string;
  category: string;
  leaderboard: LeaderboardEntry[];
}

class PublicQuizAPI {
  async getPublicQuizzes(): Promise<PublicQuiz[]> {
    const response = await fetch(`${API_BASE}/public-quiz`);

    if (!response.ok) {
      throw new Error('Failed to fetch public quizzes');
    }

    return response.json();
  }

  async getPublicQuizDetails(quizId: string): Promise<PublicQuizDetails> {
    const response = await fetch(`${API_BASE}/public-quiz/${quizId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch quiz details');
    }

    return response.json();
  }

  async startPublicQuiz(data: PublicQuizStartRequest): Promise<PublicQuizStartResponse> {
    const response = await fetch(`${API_BASE}/public-quiz/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to start quiz');
    }

    return response.json();
  }

  async submitPublicQuiz(data: PublicQuizSubmitRequest): Promise<PublicQuizSubmitResponse> {
    const response = await fetch(`${API_BASE}/public-quiz/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit quiz');
    }

    return response.json();
  }

  async getPublicQuizResults(sessionId: string): Promise<PublicQuizResults> {
    const response = await fetch(`${API_BASE}/public-quiz/results/${sessionId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch quiz results');
    }

    return response.json();
  }

  async getLeaderboard(quizId: string, limit: number = 10): Promise<LeaderboardResponse> {
    const response = await fetch(`${API_BASE}/public-quiz/leaderboard/${quizId}?limit=${limit}`);

    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard');
    }

    return response.json();
  }
}

export const publicQuizAPI = new PublicQuizAPI();
