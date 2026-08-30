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
  /**
   * Appareils joignables par push, une entrée par navigateur. `fcmToken` est
   * l'ancienne forme mono-appareil, encore écrite pour les sessions qui n'ont
   * pas rechargé l'app ; les Cloud Functions lisent les deux.
   */
  fcmToken?: string;
  fcmTokens?: string[];
  /**
   * Dernier rafraîchissement du token, écrit à chaque ouverture de l'app — mais
   * seulement quand la permission est accordée sur l'appareil. Une date qui
   * traîne loin derrière la dernière activité de la personne signe une
   * permission perdue : son ancien token reste valide côté FCM, les envois se
   * disent réussis, et plus rien ne s'affiche chez elle.
   */
  fcmTokenUpdatedAt?: Date;
  createdAt?: Date;
  firstConnectedAt?: Date;
  /**
   * Moment où la personne a copié ou partagé son lien d'accès. Porté par le doc
   * user, pas par le navigateur : c'est justement quand le stockage local est
   * effacé qu'on veut savoir si elle a de quoi revenir. Absent = la puce
   * « Mon lien » insiste.
   */
  linkSavedAt?: Date;
}
