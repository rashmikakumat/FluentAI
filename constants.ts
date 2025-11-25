import { Topic } from './types';

export const SAMPLE_TOPICS: Topic[] = [
  {
    id: 't1',
    title: 'Self Introduction',
    description: 'Tell me about yourself, your background, and your future goals.',
    prompt: 'Ask the user to introduce themselves. Focus on their background and goals.'
  },
  {
    id: 't2',
    title: 'Technology in Daily Life',
    description: 'Discuss how technology impacts our daily routines, both positively and negatively.',
    prompt: 'Discuss the impact of technology on daily life. Ask about pros and cons.'
  },
  {
    id: 't3',
    title: 'Travel Experiences',
    description: 'Share a memorable travel experience or a place you would love to visit.',
    prompt: 'Ask the user about a memorable trip or a dream destination.'
  },
  {
    id: 'custom',
    title: 'Custom Topic',
    description: 'Choose your own topic to discuss.',
    prompt: 'The user has chosen a custom topic: '
  }
];

export const ANALYSIS_SYSTEM_PROMPT = `
You are a certified IELTS and CEFR linguistic assessor. 
Analyze the provided user speech transcript or audio.
Return a valid JSON object strictly adhering to this structure:
{
  "overallScore": number (0-9),
  "cefrLevel": string ("A1" | "A2" | "B1" | "B2" | "C1" | "C2"),
  "fluency": { "score": number, "label": "Fluency & Coherence", "feedback": string },
  "pronunciation": { "score": number, "label": "Pronunciation", "feedback": string },
  "grammar": { "score": number, "label": "Grammar Range & Accuracy", "feedback": string },
  "vocabulary": { "score": number, "label": "Lexical Resource", "feedback": string },
  "strengths": [string],
  "improvements": [string],
  "annotatedTranscript": [
    { 
      "text": string (the original segment with the error), 
      "errorType": "grammar"|"pronunciation"|"fluency"|"vocabulary"|null, 
      "suggestion": string (CRITICAL: Provide the specific CORRECTED and IMPROVED version of the text. Do not just explain the error, rewrite the phrase naturally.) 
    }
  ],
  "generalFeedback": string
}
Evaluate strictly but constructively. Highlight recurring issues.
`;