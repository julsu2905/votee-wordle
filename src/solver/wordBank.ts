import englishWords from 'an-array-of-english-words';

const WORD_PATTERN = /^[a-z]+$/;
const wordsByLength = new Map<number, string[]>();

const uniqueWords = new Set(
  englishWords
    .map((word) => word.toLowerCase())
    .filter((word) => WORD_PATTERN.test(word)),
);

export const wordBank = Array.from(uniqueWords);

export const getWordsByLength = (size: number): string[] => {
  const cachedWords = wordsByLength.get(size);

  if (cachedWords) {
    return cachedWords;
  }

  const filteredWords = wordBank.filter((word) => word.length === size);
  wordsByLength.set(size, filteredWords);

  return filteredWords;
};
