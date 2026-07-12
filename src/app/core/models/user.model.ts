export interface User {
  id: string;
  token: string;
  displayOrder: number;
  quranPage?: number;
  quranCycle?: number;
  privacyMode?: boolean;
  studySurah?: number;         // sourate en cours (1-114)
  studyVerse?: number;         // dernier verset étudié (0 = pas commencé)
  studyCompletedSurahs?: number[]; // numéros des sourates terminées
  createdAt?: Date;
  firstConnectedAt?: Date;
}
