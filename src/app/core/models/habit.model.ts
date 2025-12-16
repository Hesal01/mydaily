export type HabitId = 'sun' | 'doubleSun' | 'book' | 'doubleBook' | 'three' | 'network';

export interface HabitCompletions {
  sun: boolean;
  doubleSun: boolean;
  book: boolean;
  doubleBook: boolean;
  three: boolean;
  network: boolean;
}

export interface HabitDay {
  id: string;
  userId: string;
  date: string;
  completions: HabitCompletions;
  updatedAt?: Date;
}

export function createEmptyCompletions(): HabitCompletions {
  return {
    sun: false,
    doubleSun: false,
    book: false,
    doubleBook: false,
    three: false,
    network: false
  };
}
