export type HabitId = 'sun' | 'doubleSun' | 'book' | 'three' | 'network';

export interface HabitCompletions {
  sun: boolean;
  doubleSun: boolean;
  book: boolean;
  three: boolean;
  network: boolean;
  bookPages?: number;
}

// Raw completions from Firestore (for backwards compatibility)
export interface RawHabitCompletions {
  sun?: boolean;
  doubleSun?: boolean;
  book?: boolean | number;
  doubleBook?: boolean;
  three?: boolean;
  network?: boolean;
  bookPages?: number;
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
    three: false,
    network: false,
    bookPages: 0
  };
}

// Convert raw Firestore data to normalized completions
export function normalizeCompletions(raw: RawHabitCompletions): HabitCompletions {
  let bookDone = false;
  if (typeof raw.book === 'number') {
    bookDone = raw.book > 0;
  } else if (raw.book === true) {
    bookDone = true;
  }
  // Legacy: doubleBook also counts
  if (raw.doubleBook === true) {
    bookDone = true;
  }

  return {
    sun: raw.sun ?? false,
    doubleSun: raw.doubleSun ?? false,
    book: bookDone,
    three: raw.three ?? false,
    network: raw.network ?? false,
    bookPages: raw.bookPages ?? 0
  };
}
