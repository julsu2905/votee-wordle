# Votee Wordle Solver

A Node.js TypeScript CLI that automatically plays Wordle-like puzzles using the Votee Wordle API.

The project was built for a live coding interview exercise where the goal is to write a program that guesses random words automatically. It has since been extended to support random, daily, and selected-word modes, plus repeatable tests and a benchmark runner.

## Author

**haoly**  
GitHub: [julsu2905](https://github.com/julsu2905)  
Email: hao.lynhat2905@gmail.com

## API

Base URL:

```txt
https://wordle.votee.dev:8000
```

OpenAPI/ReDoc:

```txt
https://wordle.votee.dev:8000/redoc
```

Supported endpoints:

```txt
GET /random?guess={guess}&size={size}&seed={seed}
GET /daily?guess={guess}&size={size}
GET /word/{word}?guess={guess}
```

Each guess returns slot-level feedback:

```ts
type ResultKind = "absent" | "present" | "correct";

type GuessResult = {
  slot: number;
  guess: string;
  result: ResultKind;
};
```

## Features

- Node.js CLI, no UI.
- TypeScript with strict type checking.
- API client separated from solver logic.
- Supports random, daily, and known-word puzzle modes.
- Uses `an-array-of-english-words` as the word source.
- Filters candidates by word size.
- Tracks correct positions, rejected positions, and letter count constraints.
- Handles duplicate-letter cases according to the API's observed behavior.
- Prints candidate count after each attempt for debugging.
- Includes Vitest coverage for solver and game runner scenarios.
- Includes a live benchmark runner across multiple modes.

## Install

```bash
yarn install
```

## Usage

Run a random puzzle:

```bash
yarn dev
```

Run a deterministic random puzzle:

```bash
yarn dev --mode random --seed 123
```

Run the daily puzzle:

```bash
yarn dev --mode daily
```

Run against a selected word:

```bash
yarn dev --mode word --word harry
```

Optional arguments:

```txt
--mode random|daily|word
--seed <number>
--size <number>
--max-attempts <number>
--word <word>
```

Default rules:

```txt
size: 5
max attempts: 6
mode: random
```

## Example Output

```txt
Attempt 1: aeros
1:a:present | 2:e:absent | 3:r:correct | 4:o:absent | 5:s:absent
Candidates remaining: 128
Attempt 2: cardy
1:c:absent | 2:a:correct | 3:r:correct | 4:d:absent | 5:y:correct
Candidates remaining: 12
...
Solved in 6 attempts: harry
```

## Solver Approach

The solver starts from a filtered dictionary of alphabetic words matching the requested size. After each API response, it updates constraints and filters the candidate list.

Tracked constraints:

- `correct`: the letter must appear at that exact slot.
- `present`: the letter exists but cannot be used in that rejected slot.
- `absent`: the letter is excluded when the API feedback proves it is unavailable.
- duplicate letters: minimum and maximum known letter counts are tracked to avoid over-filtering repeated-letter words.

Next guesses are selected deterministically using a simple letter-frequency score. Words with useful high-frequency unique letters are preferred, and duplicate-heavy guesses are lightly penalized.

## Known-Word Validation

Known-word mode validates the target word against the local word bank before calling the API.

For example:

```bash
yarn dev --mode word --word uidasijdkz
```

returns:

```txt
"uidasijdkz" is not included in the word bank
```

## Benchmark

Run live benchmark scenarios:

```bash
yarn benchmark
```

The benchmark currently runs:

- random mode with several seeds
- daily mode with several sizes
- known-word mode with selected words

Example summary:

```txt
[random] solved 3/3, average attempts=5.00
[daily] solved 1/3, average attempts=5.00
[word] solved 3/3, average attempts=5.67
```

Benchmark results depend on the live API and may change as the daily puzzle changes.

## Tests

Run the Vitest suite:

```bash
yarn test
```

Run TypeScript validation:

```bash
yarn typecheck
```

The tests mock the API client, so they are fast and do not require network access.

## Project Structure

```txt
src/
  api/
    wordleClient.ts
  solver/
    solver.ts
    solver.test.ts
    wordBank.ts
  types/
    an-array-of-english-words.d.ts
    wordle.ts
  benchmark.ts
  cli.ts
  gameRunner.ts
  gameRunner.test.ts
```

## Scripts

```txt
yarn dev        Run one game from the CLI
yarn benchmark  Run live benchmark scenarios
yarn test       Run Vitest tests
yarn typecheck  Run TypeScript validation
yarn build      Run TypeScript compiler
```

## Purpose

This repository demonstrates a maintainable, interview-friendly implementation of an automated Wordle solver:

- clear API boundary
- testable solver logic
- deterministic behavior
- simple CLI runner
- useful debugging output
- room for strategy improvements

Possible next improvements include expected-information-gain scoring, separate answer and guess lists, hard mode, verbose top-candidate output, and broader benchmark datasets.
