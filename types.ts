export enum AssessmentMode {
  EXTEMPORE = 'EXTEMPORE',
  CONVERSATION = 'CONVERSATION',
}

export enum SessionStatus {
  IDLE = 'IDLE',
  SETUP = 'SETUP',
  IN_PROGRESS = 'IN_PROGRESS',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  prompt: string; // Internal prompt for the AI
}

export interface FeedbackMetric {
  score: number; // 0-10
  label: string;
  feedback: string;
}

export interface AnnotatedSegment {
  text: string;
  errorType?: 'grammar' | 'pronunciation' | 'fluency' | 'vocabulary' | null;
  suggestion?: string;
}

export interface AssessmentReport {
  overallScore: number; // 0-10 or CEFR equivalent mapped number
  cefrLevel: string; // A1, A2, B1, B2, C1, C2
  fluency: FeedbackMetric;
  pronunciation: FeedbackMetric;
  grammar: FeedbackMetric;
  vocabulary: FeedbackMetric;
  strengths: string[];
  improvements: string[];
  annotatedTranscript: AnnotatedSegment[];
  generalFeedback: string;
}

export interface HistoryItem {
  id: string;
  date: string;
  mode: AssessmentMode;
  topic: string;
  report: AssessmentReport;
}

export interface AudioVisualizerData {
  volume: number;
}