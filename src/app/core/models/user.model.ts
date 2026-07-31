export interface User {
  id: string;
  token: string;
  /**
   * Salons dont la personne est membre : la frontière d'isolation des données.
   * Une même personne peut appartenir à plusieurs salons ; ses habitudes sont
   * alors partagées entre eux (cf. HabitDay.salonIds).
   */
  salonIds: string[];
  displayOrder: number;
  /**
   * Badge propre à un salon, indexé par salonId. Une même personne peut porter
   * des initiales dans un salon et rester un emoji animal dans un autre : c'est
   * la grille qui identifie, pas la personne.
   */
  labels?: Record<string, string>;
  /**
   * Badge affiché dans la grille : deux initiales (« JK »).
   * Absent = le salon utilise les emojis animaux (cf. animalIndex).
   * `labels[salonId]` prime quand il existe.
   */
  label?: string;
  /** Index dans USER_ICONS. Stocké pour que les Cloud Functions n'aient pas à le déduire de l'id. */
  animalIndex?: number;
  quranPage?: number;
  quranCycle?: number;
  privacyMode?: boolean;
  studySurah?: number;         // sourate en cours (1-114)
  studyVerse?: number;         // dernier verset étudié (0 = pas commencé)
  studyCompletedSurahs?: number[]; // numéros des sourates terminées
  studyProgress?: Record<string, number>; // mémoire par sourate : clé = n° sourate, valeur = dernier verset étudié
  createdAt?: Date;
  firstConnectedAt?: Date;
}
