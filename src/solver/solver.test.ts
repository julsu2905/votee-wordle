import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuessResult } from '../types/wordle';

const apiMocks = vi.hoisted(() => ({
  guessDaily: vi.fn(),
  guessRandom: vi.fn(),
  guessWord: vi.fn(),
}));

vi.mock('../api/wordleClient', () => apiMocks);

import { solveDailyWordle, solveKnownWordle, solveRandomWordle } from './solver';

type RandomGuessParams = {
  guess: string;
  size?: number;
  seed?: number;
};

type DailyGuessParams = {
  guess: string;
  size?: number;
};

type WordGuessParams = {
  word: string;
  guess: string;
};

const getResultForGuess = (guess: string, target: string): GuessResult[] => {
  const targetLetters = Array.from(target);
  const guessLetters = Array.from(guess);

  return guessLetters.map((letter, slot) => ({
    slot,
    guess: letter,
    result: targetLetters[slot] === letter ? 'correct' : targetLetters.includes(letter) ? 'present' : 'absent',
  }));
};

const mockRandomTarget = (target: string): void => {
  apiMocks.guessRandom.mockImplementation(async ({ guess }: RandomGuessParams) => getResultForGuess(guess, target));
};

const mockDailyTarget = (target: string): void => {
  apiMocks.guessDaily.mockImplementation(async ({ guess }: DailyGuessParams) => getResultForGuess(guess, target));
};

const mockKnownWordTarget = (): void => {
  apiMocks.guessWord.mockImplementation(async ({ word, guess }: WordGuessParams) => getResultForGuess(guess, word));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('solver smoke scenarios', () => {
  it('solves a seeded random puzzle with duplicate letters', async () => {
    mockRandomTarget('harry');

    const result = await solveRandomWordle({ seed: 123, maxAttempts: 6 });

    expect(result.solved).toBe(true);
    expect(result.finalGuess).toBe('harry');
    expect(result.attempts).toHaveLength(6);
    expect(result.attempts[0].candidatesRemaining).toBeGreaterThan(0);
    expect(apiMocks.guessRandom).toHaveBeenCalledWith({
      guess: 'aeros',
      size: 5,
      seed: 123,
    });
  });

  it('runs daily mode through the daily endpoint', async () => {
    mockDailyTarget('lenti');

    const result = await solveDailyWordle({ maxAttempts: 6 });

    expect(result.solved).toBe(true);
    expect(result.finalGuess).toBe('lenti');
    expect(apiMocks.guessDaily).toHaveBeenCalled();
    expect(apiMocks.guessRandom).not.toHaveBeenCalled();
    expect(apiMocks.guessWord).not.toHaveBeenCalled();
  });

  it('runs known-word mode through the word endpoint', async () => {
    mockKnownWordTarget();

    const result = await solveKnownWordle('harry', { maxAttempts: 6 });

    expect(result.solved).toBe(true);
    expect(result.finalGuess).toBe('harry');
    expect(apiMocks.guessWord).toHaveBeenCalledWith({
      word: 'harry',
      guess: expect.any(String) as string,
    });
  });

  it('solves duplicate-letter words with the API result semantics', async () => {
    mockKnownWordTarget();

    const result = await solveKnownWordle('level', { maxAttempts: 6 });

    expect(result.solved).toBe(true);
    expect(result.finalGuess).toBe('level');
  });

  it('rejects a known word that is not in the local word bank', async () => {
    mockKnownWordTarget();

    await expect(solveKnownWordle('uidasijdkz')).rejects.toThrow('"uidasijdkz" is not included in the word bank');
    expect(apiMocks.guessWord).not.toHaveBeenCalled();
  });
});
