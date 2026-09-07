import { runGame } from './gameRunner';

const main = async (): Promise<void> => {
  await runGame(process.argv.slice(2));
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  console.error(message);
  process.exitCode = 1;
});
