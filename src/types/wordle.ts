export type ResultKind = 'absent' | 'present' | 'correct';

export type GuessResult = {
  slot: number;
  guess: string;
  result: ResultKind;
};

export type ApiValidationError = {
  detail?: Array<{
    loc: string[];
    msg: string;
    type: string;
  }>;
};
