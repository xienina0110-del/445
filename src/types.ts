export interface Question {
  id: string;
  originalImage?: string;
  content: string;
  options?: string[];
  userAnswer?: string;
  standardAnswer?: string;
  knowledgePoint: string;
  subject?: string;
  timestamp: number;
  similarQuestions: SimilarQuestion[];
}

export interface SimilarQuestion {
  content: string;
  options?: string[];
  answer: string;
  explanation: string;
  commonMistakes: string;
}

export type AppView = 'home' | 'scan' | 'edit' | 'analysis' | 'history';
