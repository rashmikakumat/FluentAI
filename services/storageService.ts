import { HistoryItem } from '../types';

const STORAGE_KEY = 'fluent_ai_history';

// Helper to check if a report has the minimum required structure to render without crashing
const isValidItem = (item: any): boolean => {
  if (!item || !item.report) return false;
  const r = item.report;
  // Check for critical nested objects that are accessed via .score
  return (
    typeof r.overallScore === 'number' &&
    !!r.fluency && typeof r.fluency.score === 'number' &&
    !!r.grammar && typeof r.grammar.score === 'number' &&
    !!r.pronunciation && typeof r.pronunciation.score === 'number' &&
    !!r.vocabulary && typeof r.vocabulary.score === 'number'
  );
};

export const getHistory = (): HistoryItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    // Filter out corrupt items to prevent UI crashes (like "Cannot read property 'score' of undefined")
    return parsed.filter(isValidItem);
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveHistoryItem = (item: HistoryItem) => {
  try {
    const current = getHistory();
    // Keep last 10 items
    const updated = [item, ...current].slice(0, 10); 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save history", e);
  }
};