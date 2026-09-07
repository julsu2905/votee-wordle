import { performance } from 'node:perf_hooks';
import { solveDailyWordle, solveKnownWordle, solveRandomWordle, type SolveResult } from './solver/solver';

type BenchmarkMode = 'random' | 'daily' | 'word';

type BenchmarkCase = {
  mode: BenchmarkMode;
  name: string;
  run: () => Promise<SolveResult>;
};

type BenchmarkResult = {
  mode: BenchmarkMode;
  name: string;
  solved: boolean;
  attempts: number;
  finalGuess: string;
  candidatesRemaining: number;
  durationMs: number;
  error?: string;
};

const silentLogger = (): void => undefined;

const benchmarkCases: BenchmarkCase[] = [
  {
    mode: 'random',
    name: 'seed 123, size 5',
    run: () => solveRandomWordle({ seed: 123, size: 5, maxAttempts: 6, logger: silentLogger }),
  },
  {
    mode: 'random',
    name: 'seed 456, size 5',
    run: () => solveRandomWordle({ seed: 456, size: 5, maxAttempts: 6, logger: silentLogger }),
  },
  {
    mode: 'random',
    name: 'seed 789, size 5',
    run: () => solveRandomWordle({ seed: 789, size: 5, maxAttempts: 6, logger: silentLogger }),
  },
  {
    mode: 'daily',
    name: 'daily size 4',
    run: () => solveDailyWordle({ size: 4, maxAttempts: 6, logger: silentLogger }),
  },
  {
    mode: 'daily',
    name: 'daily size 5',
    run: () => solveDailyWordle({ size: 5, maxAttempts: 6, logger: silentLogger }),
  },
  {
    mode: 'daily',
    name: 'daily size 6',
    run: () => solveDailyWordle({ size: 6, maxAttempts: 6, logger: silentLogger }),
  },
  {
    mode: 'word',
    name: 'word harry',
    run: () => solveKnownWordle('harry', { maxAttempts: 6, logger: silentLogger }),
  },
  {
    mode: 'word',
    name: 'word array',
    run: () => solveKnownWordle('array', { maxAttempts: 6, logger: silentLogger }),
  },
  {
    mode: 'word',
    name: 'word level',
    run: () => solveKnownWordle('level', { maxAttempts: 6, logger: silentLogger }),
  },
];

const runBenchmarkCase = async (benchmarkCase: BenchmarkCase): Promise<BenchmarkResult> => {
  const startedAt = performance.now();

  try {
    const result = await benchmarkCase.run();
    const lastAttempt = result.attempts.at(-1);

    return {
      mode: benchmarkCase.mode,
      name: benchmarkCase.name,
      solved: result.solved,
      attempts: result.attempts.length,
      finalGuess: result.finalGuess ?? 'none',
      candidatesRemaining: lastAttempt?.candidatesRemaining ?? 0,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error: unknown) {
    return {
      mode: benchmarkCase.mode,
      name: benchmarkCase.name,
      solved: false,
      attempts: 0,
      finalGuess: 'none',
      candidatesRemaining: 0,
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : 'Unexpected error',
    };
  }
};

const printResult = (result: BenchmarkResult): void => {
  const status = result.solved ? 'solved' : 'failed';
  const error = result.error ? ` error="${result.error}"` : '';

  console.log(
    `[${result.mode}] ${result.name}: ${status}, attempts=${result.attempts}, final=${result.finalGuess}, candidates=${result.candidatesRemaining}, duration=${result.durationMs}ms${error}`,
  );
};

const printModeSummary = (mode: BenchmarkMode, results: BenchmarkResult[]): void => {
  const modeResults = results.filter((result) => result.mode === mode);
  const solvedResults = modeResults.filter((result) => result.solved);
  const averageAttempts =
    solvedResults.length === 0
      ? 0
      : solvedResults.reduce((sum, result) => sum + result.attempts, 0) / solvedResults.length;

  console.log(
    `[${mode}] solved ${solvedResults.length}/${modeResults.length}, average attempts=${averageAttempts.toFixed(2)}`,
  );
};

const main = async (): Promise<void> => {
  console.log(`Running ${benchmarkCases.length} benchmark scenarios...`);

  const results: BenchmarkResult[] = [];

  for (const benchmarkCase of benchmarkCases) {
    const result = await runBenchmarkCase(benchmarkCase);
    results.push(result);
    printResult(result);
  }

  console.log('');
  printModeSummary('random', results);
  printModeSummary('daily', results);
  printModeSummary('word', results);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  console.error(message);
  process.exitCode = 1;
});
