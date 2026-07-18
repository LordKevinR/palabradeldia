import { targetWords, validWords } from './wordlists.js';

// Setup validWords set for O(1) lookups
const validWordsSet = new Set(validWords);

export function cleanWord(word) {
  if (typeof word !== 'string') return '';
  let w = word.toLowerCase().trim();
  w = w.replace(/[áäâà]/g, 'a');
  w = w.replace(/[éëêè]/g, 'e');
  w = w.replace(/[íïîì]/g, 'i');
  w = w.replace(/[óöôò]/g, 'o');
  w = w.replace(/[úüûù]/g, 'u');
  w = w.toUpperCase();
  w = w.replace(/[^A-ZÑ]/g, '');
  return w;
}

export function isValidWord(word) {
  const cleaned = cleanWord(word);
  return cleaned.length === 5 && validWordsSet.has(cleaned);
}

// Deterministic hash function for strings
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Mulberry32 generator for deterministic random numbers
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// Shuffle targetWords once deterministically on startup
const SHUFFLE_SEED = 987654321;
function shuffle(array, seed) {
  const rand = mulberry32(seed);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

const shuffledTargetWords = shuffle(targetWords, SHUFFLE_SEED);
const GAME_EPOCH = new Date('2026-07-01T00:00:00Z'); // Fixed UTC start date reference

// Returns the word of the day for a specific date and index (1 to 10)
export function getDailyWord(dateStr, wordIndex) {
  const index = Math.min(Math.max(parseInt(wordIndex, 10) || 1, 1), 10);
  
  // Parse date safely in UTC to avoid timezone discrepancies
  const clientDate = new Date(`${dateStr}T00:00:00Z`);
  const diffTime = clientDate - GAME_EPOCH;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Sequential index based on days elapsed
  const globalIndex = diffDays * 10 + (index - 1);
  
  // Safe modulo to wrap around array
  const arrayLen = shuffledTargetWords.length;
  const wordIdx = ((globalIndex % arrayLen) + arrayLen) % arrayLen;
  
  return shuffledTargetWords[wordIdx];
}

// Returns all 10 words of the day for a specific date (used internally or with authorization)
export function getDailyWordsForDate(dateStr) {
  const words = [];
  for (let i = 1; i <= 10; i++) {
    words.push(getDailyWord(dateStr, i));
  }
  return words;
}
