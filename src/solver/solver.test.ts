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
    expect(result.attempts.length).toBeLessThanOrEqual(6);
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

  it.each([
    { size: 4, target: 'code' },
    { size: 6, target: 'spouse' },
  ])('solves random mode with $size-letter words', async ({ size, target }) => {
    mockRandomTarget(target);

    const result = await solveRandomWordle({ seed: 1, size, maxAttempts: 6 });

    expect(result.solved).toBe(true);
    expect(result.finalGuess).toBe(target);
    expect(apiMocks.guessRandom).toHaveBeenLastCalledWith({
      guess: target,
      size,
      seed: 1,
    });
  });

  it.each([
    { size: 4, target: 'code' },
    { size: 6, target: 'spouse' },
  ])('solves daily mode with $size-letter words', async ({ size, target }) => {
    mockDailyTarget(target);

    const result = await solveDailyWordle({ size, maxAttempts: 6 });

    expect(result.solved).toBe(true);
    expect(result.finalGuess).toBe(target);
    expect(apiMocks.guessDaily).toHaveBeenLastCalledWith({
      guess: target,
      size,
    });
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

  it.each(['code', 'spouse'])('solves known-word mode for different word sizes: %s', async (target) => {
    mockKnownWordTarget();

    const result = await solveKnownWordle(target, { maxAttempts: 6 });

    expect(result.solved).toBe(true);
    expect(result.finalGuess).toBe(target);
    expect(apiMocks.guessWord).toHaveBeenLastCalledWith({
      word: target,
      guess: target,
    });
  });

  it('rejects a known word that is not in the local word bank', async () => {
    mockKnownWordTarget();

    await expect(solveKnownWordle('uidasijdkz')).rejects.toThrow('"uidasijdkz" is not included in the word bank');
    expect(apiMocks.guessWord).not.toHaveBeenCalled();
  });

  it('stops when feedback removes every word-bank candidate', async () => {
    mockDailyTarget('bali');

    const result = await solveDailyWordle({ size: 4, maxAttempts: 6 });

    expect(result.solved).toBe(false);
    expect(result.message).toBe('No candidates remain in the word bank for the current feedback');
    expect(result.attempts.at(-1)?.candidatesRemaining).toBe(0);
    expect(apiMocks.guessDaily).toHaveBeenCalledTimes(result.attempts.length);
    expect(result.attempts.length).toBeLessThanOrEqual(6);
  });
});
