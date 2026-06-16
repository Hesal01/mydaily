export interface User {
  id: string;
  token: string;
  displayOrder: number;
  quranPage?: number;
  quranCycle?: number;
  privacyMode?: boolean;
  createdAt?: Date;
  firstConnectedAt?: Date;
}
