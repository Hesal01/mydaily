export interface User {
  id: string;
  token: string;
  displayOrder: number;
  quranPage?: number;
  quranCycle?: number;
  createdAt?: Date;
}
