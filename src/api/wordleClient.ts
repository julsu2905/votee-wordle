import type { ApiValidationError, GuessResult } from '../types/wordle';

const API_BASE_URL = 'https://wordle.votee.dev:8000';

type GuessRandomParams = {
  guess: string;
  size?: number;
  seed?: number;
};

type GuessDailyParams = {
  guess: string;
  size?: number;
};

type GuessWordParams = {
  word: string;
  guess: string;
};

const assertNonEmpty = (value: string, fieldName: string): string => {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
};

const createQueryString = (params: Record<string, string | number | undefined>): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  });

  return searchParams.toString();
};

const getValidationMessage = (error: ApiValidationError): string | undefined => {
  if (!error.detail?.length) {
    return undefined;
  }

  return error.detail.map((item) => `${item.loc.join('.')}: ${item.msg}`).join('; ');
};

const requestGuess = async (path: string, query: Record<string, string | number | undefined>): Promise<GuessResult[]> => {
  const queryString = createQueryString(query);
  const response = await fetch(`${API_BASE_URL}${path}?${queryString}`);

  if (!response.ok) {
    const fallbackMessage = `Wordle API request failed with ${response.status} ${response.statusText}`;
    let errorMessage = fallbackMessage;

    try {
      const error = (await response.json()) as ApiValidationError;
      errorMessage = getValidationMessage(error) ?? fallbackMessage;
    } catch {
      errorMessage = fallbackMessage;
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as GuessResult[];
};

export const guessRandom = async ({ guess, size, seed }: GuessRandomParams): Promise<GuessResult[]> => {
  return requestGuess('/random', {
    guess: assertNonEmpty(guess, 'guess'),
    size,
    seed,
  });
};

export const guessDaily = async ({ guess, size }: GuessDailyParams): Promise<GuessResult[]> => {
  return requestGuess('/daily', {
    guess: assertNonEmpty(guess, 'guess'),
    size,
  });
};

export const guessWord = async ({ word, guess }: GuessWordParams): Promise<GuessResult[]> => {
  const normalizedWord = assertNonEmpty(word, 'word');

  return requestGuess(`/word/${encodeURIComponent(normalizedWord)}`, {
    guess: assertNonEmpty(guess, 'guess'),
  });
};
