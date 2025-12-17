export type HabitId = 'sun' | 'book' | 'three' | 'network';

export interface HabitCompletions {
  sun: number;
  book: number;
  three: number;
  network: number;
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
    sun: 0,
    book: 0,
    three: 0,
    network: 0
  };
}
