import { guessDaily, guessRandom, guessWord } from '../api/wordleClient';
import type { GuessResult, ResultKind } from '../types/wordle';
import { getWordsByLength } from './wordBank';

const DEFAULT_WORD_LENGTH = 5;
const DEFAULT_MAX_ATTEMPTS = 6;
const INFO_GAIN_SCORING_THRESHOLD = 500;
const MAX_INFO_GAIN_PROBES = 700;

type SolverLogger = (message: string) => void;

export type SolverOptions = {
  seed?: number;
  size?: number;
  maxAttempts?: number;
  logger?: SolverLogger;
};

export type KnownWordSolverOptions = Omit<SolverOptions, 'seed' | 'size'>;

export type AttemptResult = {
  attempt: number;
  guess: string;
  result: GuessResult[];
  candidatesRemaining: number;
};

export type SolveResult = {
  solved: boolean;
  attempts: AttemptResult[];
  finalGuess?: string;
  message?: string;
};

type Constraints = {
  correctLetters: Array<string | undefined>;
  rejectedPositions: Map<string, Set<number>>;
  minLetterCounts: Map<string, number>;
  maxLetterCounts: Map<string, number>;
};

type GuessProvider = (guess: string) => Promise<GuessResult[]>;

const createConstraints = (size: number): Constraints => ({
  correctLetters: Array<string | undefined>(size).fill(undefined),
  rejectedPositions: new Map<string, Set<number>>(),
  minLetterCounts: new Map<string, number>(),
  maxLetterCounts: new Map<string, number>(),
});

const isSolved = (result: GuessResult[], size: number): boolean => {
  return result.length === size && result.every((item) => item.result === 'correct');
};

const addRejectedPosition = (constraints: Constraints, letter: string, slot: number): void => {
  const rejectedSlots = constraints.rejectedPositions.get(letter) ?? new Set<number>();
  rejectedSlots.add(slot);
  constraints.rejectedPositions.set(letter, rejectedSlots);
};

const mergeMinLetterCount = (constraints: Constraints, letter: string, count: number): void => {
  constraints.minLetterCounts.set(letter, Math.max(constraints.minLetterCounts.get(letter) ?? 0, count));
};

const mergeMaxLetterCount = (constraints: Constraints, letter: string, count: number): void => {
  const currentMax = constraints.maxLetterCounts.get(letter);
  constraints.maxLetterCounts.set(letter, currentMax === undefined ? count : Math.min(currentMax, count));
};

const applyResultToConstraints = (constraints: Constraints, result: GuessResult[]): void => {
  const guessedLetters = new Set(result.map((item) => item.guess.toLowerCase()));

  guessedLetters.forEach((letter) => {
    const guessedLetterResults = result.filter((item) => item.guess.toLowerCase() === letter);
    const correctCount = guessedLetterResults.filter((item) => item.result === 'correct').length;
    const hasPositiveResult = guessedLetterResults.some((item) => item.result === 'correct' || item.result === 'present');
    const hasAbsentResult = guessedLetterResults.some((item) => item.result === 'absent');

    if (hasPositiveResult) {
      mergeMinLetterCount(constraints, letter, Math.max(correctCount, 1));
    }

    if (hasAbsentResult && !hasPositiveResult) {
      mergeMaxLetterCount(constraints, letter, 0);
    }
  });

  result.forEach((item) => {
    const letter = item.guess.toLowerCase();

    if (item.result === 'correct') {
      constraints.correctLetters[item.slot] = letter;
      return;
    }

    if (item.result === 'present') {
      addRejectedPosition(constraints, letter, item.slot);
      return;
    }

    addRejectedPosition(constraints, letter, item.slot);
  });
};

const matchesCorrectLetters = (word: string, correctLetters: Array<string | undefined>): boolean => {
  return correctLetters.every((letter, index) => letter === undefined || word[index] === letter);
};

const avoidsRejectedPositions = (word: string, rejectedPositions: Map<string, Set<number>>): boolean => {
  return Array.from(rejectedPositions.entries()).every(([letter, slots]) => {
    return Array.from(slots).every((slot) => word[slot] !== letter);
  });
};

const getLetterCount = (word: string, letter: string): number => {
  return Array.from(word).filter((wordLetter) => wordLetter === letter).length;
};

const matchesLetterCounts = (
  word: string,
  minLetterCounts: Map<string, number>,
  maxLetterCounts: Map<string, number>,
): boolean => {
  const meetsMinCounts = Array.from(minLetterCounts.entries()).every(([letter, count]) => {
    return getLetterCount(word, letter) >= count;
  });

  const meetsMaxCounts = Array.from(maxLetterCounts.entries()).every(([letter, count]) => {
    return getLetterCount(word, letter) <= count;
  });

  return meetsMinCounts && meetsMaxCounts;
};

const filterCandidates = (candidates: string[], constraints: Constraints): string[] => {
  return candidates.filter((word) => {
    return (
      matchesCorrectLetters(word, constraints.correctLetters) &&
      avoidsRejectedPositions(word, constraints.rejectedPositions) &&
      matchesLetterCounts(word, constraints.minLetterCounts, constraints.maxLetterCounts)
    );
  });
};

const encodeResultPattern = (guess: string, target: string): string => {
  return Array.from(guess)
    .map((letter, index) => {
      if (target[index] === letter) {
        return 'c';
      }

      return target.includes(letter) ? 'p' : 'a';
    })
    .join('');
};

const buildLetterFrequency = (words: string[]): Map<string, number> => {
  const frequency = new Map<string, number>();

  words.forEach((word) => {
    new Set(word).forEach((letter) => {
      frequency.set(letter, (frequency.get(letter) ?? 0) + 1);
    });
  });

  return frequency;
};

const scoreWord = (word: string, frequency: Map<string, number>): number => {
  const uniqueLetters = new Set(word);
  const duplicatePenalty = word.length - uniqueLetters.size;

  return Array.from(uniqueLetters).reduce((score, letter) => score + (frequency.get(letter) ?? 0), 0) - duplicatePenalty;
};

const chooseBestFrequencyGuess = (
  words: string[],
  guessedWords: Set<string>,
  frequencySource: string[],
): string | undefined => {
  const frequency = buildLetterFrequency(frequencySource);

  return words
    .filter((word) => !guessedWords.has(word))
    .sort((left, right) => scoreWord(right, frequency) - scoreWord(left, frequency) || left.localeCompare(right))[0];
};

type InformationScore = {
  expectedRemaining: number;
  entropy: number;
  largestGroupSize: number;
  groupCount: number;
};

const getInformationScore = (guess: string, candidates: string[]): InformationScore => {
  const groups = new Map<string, number>();

  candidates.forEach((candidate) => {
    const pattern = encodeResultPattern(guess, candidate);
    groups.set(pattern, (groups.get(pattern) ?? 0) + 1);
  });

  const totalCandidates = candidates.length;
  const groupSizes = Array.from(groups.values());

  return {
    expectedRemaining: groupSizes.reduce((sum, size) => sum + (size / totalCandidates) * size, 0),
    entropy: groupSizes.reduce((sum, size) => {
      const probability = size / totalCandidates;

      return sum - probability * Math.log2(probability);
    }, 0),
    largestGroupSize: Math.max(...groupSizes),
    groupCount: groups.size,
  };
};

const getInformationGainProbes = (candidates: string[], allWords: string[]): string[] => {
  const frequency = buildLetterFrequency(candidates);
  const topFrequencyWords = [...allWords]
    .sort((left, right) => scoreWord(right, frequency) - scoreWord(left, frequency) || left.localeCompare(right))
    .slice(0, MAX_INFO_GAIN_PROBES);

  return Array.from(new Set([...candidates, ...topFrequencyWords]));
};

const chooseBestInformationGuess = (
  candidates: string[],
  allWords: string[],
  guessedWords: Set<string>,
  attemptsRemaining: number,
): string | undefined => {
  if (candidates.length <= attemptsRemaining) {
    return chooseBestFrequencyGuess(candidates, guessedWords, candidates);
  }

  const probes = getInformationGainProbes(candidates, allWords);
  const frequency = buildLetterFrequency(candidates);
  let bestGuess: string | undefined;
  let bestExpectedRemaining = Number.POSITIVE_INFINITY;
  let bestEntropy = Number.NEGATIVE_INFINITY;
  let bestLargestGroupSize = Number.POSITIVE_INFINITY;
  let bestGroupCount = 0;
  let bestIsCandidate = false;
  let bestFrequencyScore = Number.NEGATIVE_INFINITY;

  probes.forEach((word) => {
    if (guessedWords.has(word)) {
      return;
    }

    const { expectedRemaining, entropy, largestGroupSize, groupCount } = getInformationScore(word, candidates);
    const isCandidate = candidates.includes(word);
    const frequencyScore = scoreWord(word, frequency);
    const isBetter =
      expectedRemaining < bestExpectedRemaining ||
      (expectedRemaining === bestExpectedRemaining && entropy > bestEntropy) ||
      (expectedRemaining === bestExpectedRemaining && entropy === bestEntropy && largestGroupSize < bestLargestGroupSize) ||
      (expectedRemaining === bestExpectedRemaining &&
        entropy === bestEntropy &&
        largestGroupSize === bestLargestGroupSize &&
        groupCount > bestGroupCount) ||
      (expectedRemaining === bestExpectedRemaining &&
        entropy === bestEntropy &&
        largestGroupSize === bestLargestGroupSize &&
        groupCount === bestGroupCount &&
        frequencyScore > bestFrequencyScore) ||
      (expectedRemaining === bestExpectedRemaining &&
        entropy === bestEntropy &&
        largestGroupSize === bestLargestGroupSize &&
        groupCount === bestGroupCount &&
        frequencyScore === bestFrequencyScore &&
        isCandidate &&
        !bestIsCandidate) ||
      (expectedRemaining === bestExpectedRemaining &&
        entropy === bestEntropy &&
        largestGroupSize === bestLargestGroupSize &&
        groupCount === bestGroupCount &&
        frequencyScore === bestFrequencyScore &&
        isCandidate === bestIsCandidate &&
        (bestGuess === undefined || word.localeCompare(bestGuess) < 0));

    if (isBetter) {
      bestGuess = word;
      bestExpectedRemaining = expectedRemaining;
      bestEntropy = entropy;
      bestLargestGroupSize = largestGroupSize;
      bestGroupCount = groupCount;
      bestIsCandidate = isCandidate;
      bestFrequencyScore = frequencyScore;
    }
  });

  return bestGuess;
};

const chooseNextGuess = (
  candidates: string[],
  allWords: string[],
  guessedWords: Set<string>,
  attemptsRemaining: number,
): string | undefined => {
  if (candidates.length === 0) {
    return undefined;
  }

  if (candidates.length === 1) {
    return candidates.find((word) => !guessedWords.has(word));
  }

  if (candidates.length <= INFO_GAIN_SCORING_THRESHOLD) {
    return chooseBestInformationGuess(candidates, allWords, guessedWords, attemptsRemaining);
  }

  return (
    chooseBestFrequencyGuess(candidates, guessedWords, candidates) ??
    chooseBestFrequencyGuess(allWords, guessedWords, allWords)
  );
};

const resolvePositiveInteger = (value: number | undefined, fallback: number, fieldName: string): number => {
  const resolvedValue = value ?? fallback;

  if (!Number.isInteger(resolvedValue) || resolvedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return resolvedValue;
};

const formatResult = (result: GuessResult[]): string => {
  return result
    .map((item) => {
      const label: Record<ResultKind, string> = {
        absent: 'absent',
        present: 'present',
        correct: 'correct',
      };

      return `${item.slot + 1}:${item.guess}:${label[item.result]}`;
    })
    .join(' | ');
};

const solveWordle = async (
  size: number,
  maxAttempts: number,
  guessProvider: GuessProvider,
  logger: SolverLogger = console.log,
): Promise<SolveResult> => {
  const allWords = getWordsByLength(size);

  if (allWords.length === 0) {
    throw new Error(`No ${size}-letter words are available for solving`);
  }

  const constraints = createConstraints(size);
  const guessedWords = new Set<string>();
  const attempts: AttemptResult[] = [];
  let candidates = allWords;
  let nextGuess = chooseNextGuess(candidates, allWords, guessedWords, maxAttempts);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (!nextGuess) {
      break;
    }

    guessedWords.add(nextGuess);

    const result = await guessProvider(nextGuess);

    applyResultToConstraints(constraints, result);
    candidates = filterCandidates(candidates, constraints);

    attempts.push({
      attempt,
      guess: nextGuess,
      result,
      candidatesRemaining: candidates.length,
    });

    logger(`Attempt ${attempt}: ${nextGuess}`);
    logger(formatResult(result));
    logger(`Candidates remaining: ${candidates.length}`);

    if (isSolved(result, size)) {
      return {
        solved: true,
        attempts,
        finalGuess: nextGuess,
      };
    }

    if (candidates.length === 0) {
      const message = 'No candidates remain in the word bank for the current feedback';

      return {
        solved: false,
        attempts,
        finalGuess: nextGuess,
        message,
      };
    }

    nextGuess = chooseNextGuess(candidates, allWords, guessedWords, maxAttempts - attempt);
  }

  return {
    solved: false,
    attempts,
    finalGuess: attempts.at(-1)?.guess,
    message: `Failed to solve within ${maxAttempts} attempts`,
  };
};

export const solveRandomWordle = async (options: SolverOptions = {}): Promise<SolveResult> => {
  const size = resolvePositiveInteger(options.size, DEFAULT_WORD_LENGTH, 'size');
  const maxAttempts = resolvePositiveInteger(options.maxAttempts, DEFAULT_MAX_ATTEMPTS, 'maxAttempts');

  return solveWordle(
    size,
    maxAttempts,
    (guess) =>
      guessRandom({
        guess,
        size,
        seed: options.seed,
      }),
    options.logger,
  );
};

export const solveDailyWordle = async (options: SolverOptions = {}): Promise<SolveResult> => {
  const size = resolvePositiveInteger(options.size, DEFAULT_WORD_LENGTH, 'size');
  const maxAttempts = resolvePositiveInteger(options.maxAttempts, DEFAULT_MAX_ATTEMPTS, 'maxAttempts');

  return solveWordle(
    size,
    maxAttempts,
    (guess) =>
      guessDaily({
        guess,
        size,
      }),
    options.logger,
  );
};

export const solveKnownWordle = async (word: string, options: KnownWordSolverOptions = {}): Promise<SolveResult> => {
  const normalizedWord = word.trim().toLowerCase();

  if (!/^[a-z]+$/.test(normalizedWord)) {
    throw new Error('word must contain alphabetic characters only');
  }

  const size = normalizedWord.length;
  const maxAttempts = resolvePositiveInteger(options.maxAttempts, DEFAULT_MAX_ATTEMPTS, 'maxAttempts');

  const allWords = getWordsByLength(size);

  if (!allWords.includes(normalizedWord)) {
    throw new Error(`"${normalizedWord}" is not included in the word bank`);
  }

  return solveWordle(
    size,
    maxAttempts,
    (guess) =>
      guessWord({
        word: normalizedWord,
        guess,
      }),
    options.logger,
  );
};
