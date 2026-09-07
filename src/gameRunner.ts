import { solveDailyWordle, solveKnownWordle, solveRandomWordle, type SolveResult } from './solver/solver';

type SolveMode = 'random' | 'daily' | 'word';

const modes = new Set<SolveMode>(['random', 'daily', 'word']);

const parseStringArg = (args: string[], name: string): string | undefined => {
  const argIndex = args.indexOf(name);

  if (argIndex === -1) {
    return undefined;
  }

  const value = args[argIndex + 1];

  if (!value) {
    throw new Error(`${name} must be followed by a value`);
  }

  return value;
};

const parseModeArg = (args: string[]): SolveMode => {
  const rawMode = parseStringArg(args, '--mode') ?? 'random';

  if (!modes.has(rawMode as SolveMode)) {
    throw new Error('--mode must be one of: random, daily, word');
  }

  return rawMode as SolveMode;
};

const parseIntegerArg = (args: string[], name: string): number | undefined => {
  const argIndex = args.indexOf(name);

  if (argIndex === -1) {
    return undefined;
  }

  const rawValue = args[argIndex + 1];
  const value = Number(rawValue);

  if (!rawValue || !Number.isInteger(value)) {
    throw new Error(`${name} must be followed by an integer`);
  }

  return value;
};

const printSummary = (result: SolveResult): void => {
  if (result.solved) {
    console.log(`Solved in ${result.attempts.length} attempts: ${result.finalGuess}`);
    return;
  }

  console.log(`Failed after ${result.attempts.length} attempts. Last guess: ${result.finalGuess ?? 'none'}`);
};

export const runGame = async (args: string[]): Promise<SolveResult> => {
  const mode = parseModeArg(args);
  const seed = parseIntegerArg(args, '--seed');
  const size = parseIntegerArg(args, '--size');
  const maxAttempts = parseIntegerArg(args, '--max-attempts');
  const word = parseStringArg(args, '--word');
  let result: SolveResult;

  if (mode === 'daily') {
    result = await solveDailyWordle({ size, maxAttempts });
  } else if (mode === 'word') {
    if (!word) {
      throw new Error('--word is required when --mode word is used');
    }

    result = await solveKnownWordle(word, { maxAttempts });
  } else {
    result = await solveRandomWordle({ seed, size, maxAttempts });
  }

  printSummary(result);

  return result;
};
