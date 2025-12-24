export type HabitId = 'sun' | 'doubleSun' | 'book' | 'three' | 'network';

export interface HabitCompletions {
  sun: boolean;
  doubleSun: boolean;
  book: number;
  three: boolean;
  network: boolean;
}

// Raw completions from Firestore (for backwards compatibility)
export interface RawHabitCompletions {
  sun?: boolean;
  doubleSun?: boolean;
  book?: boolean | number;
  doubleBook?: boolean;
  three?: boolean;
  network?: boolean;
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
    book: 0,
    three: false,
    network: false
  };
}

// Convert raw Firestore data to normalized completions
export function normalizeCompletions(raw: RawHabitCompletions): HabitCompletions {
  let bookCount = 0;
  if (typeof raw.book === 'number') {
    bookCount = raw.book;
  } else if (raw.book === true) {
    bookCount = 1;
  }
  // Legacy: doubleBook adds 1 more (book + doubleBook = 2 total)
  if (raw.doubleBook === true) {
    bookCount += 1;
  }

  return {
    sun: raw.sun ?? false,
    doubleSun: raw.doubleSun ?? false,
    book: Math.min(bookCount, 5),
    three: raw.three ?? false,
    network: raw.network ?? false
  };
}
