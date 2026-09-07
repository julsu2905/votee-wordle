import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SolveResult } from './solver/solver';

const solverMocks = vi.hoisted(() => ({
  solveDailyWordle: vi.fn(),
  solveKnownWordle: vi.fn(),
  solveRandomWordle: vi.fn(),
}));

vi.mock('./solver/solver', () => solverMocks);

import { runGame } from './gameRunner';

const solvedResult: SolveResult = {
  solved: true,
  attempts: [],
  finalGuess: 'harry',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('game runner', () => {
  it('dispatches random mode with seed, size, and max attempts', async () => {
    solverMocks.solveRandomWordle.mockResolvedValue(solvedResult);

    await runGame(['--mode', 'random', '--seed', '123', '--size', '5', '--max-attempts', '6']);

    expect(solverMocks.solveRandomWordle).toHaveBeenCalledWith({
      seed: 123,
      size: 5,
      maxAttempts: 6,
    });
  });

  it('dispatches daily mode', async () => {
    solverMocks.solveDailyWordle.mockResolvedValue(solvedResult);

    await runGame(['--mode', 'daily', '--size', '5', '--max-attempts', '6']);

    expect(solverMocks.solveDailyWordle).toHaveBeenCalledWith({
      size: 5,
      maxAttempts: 6,
    });
  });

  it('dispatches known-word mode', async () => {
    solverMocks.solveKnownWordle.mockResolvedValue(solvedResult);

    await runGame(['--mode', 'word', '--word', 'harry', '--max-attempts', '6']);

    expect(solverMocks.solveKnownWordle).toHaveBeenCalledWith('harry', {
      maxAttempts: 6,
    });
  });

  it('requires --word for known-word mode', async () => {
    await expect(runGame(['--mode', 'word'])).rejects.toThrow('--word is required when --mode word is used');
  });
});
