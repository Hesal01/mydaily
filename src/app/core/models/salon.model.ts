import { HabitId } from './habit.model';

/**
 * Un salon regroupe un ensemble de personnes qui partagent la même grille.
 *
 * C'est la frontière d'isolation : `users` et `habits` portent un tableau
 * `salonIds`, `congratulations` un `salonId` simple (un bravo part d'un salon
 * précis), et toutes les lectures de l'app sont filtrées dessus. Deux salons ne
 * se voient jamais.
 *
 * Le token d'accès reste attaché à une personne ; c'est son doc user qui la
 * rattache à ses salons. Quelqu'un présent dans plusieurs salons coche ses
 * habitudes une fois et sa journée est visible dans chacun.
 */
export interface Salon {
  id: string;
  name: string;
  /**
   * Habitudes suivies par ce salon, dans l'ordre de HABITS. Absent ou vide =
   * toutes : les salons d'avant ce champ ne changent pas d'affichage.
   *
   * L'écran Étude en dépend — il n'existe que pour l'habitude `study`, donc un
   * salon qui ne la suit pas ne l'affiche pas.
   */
  habitIds?: HabitId[];
  createdAt?: Date;
}

/** Salon historique : celui qui existait avant l'introduction des salons. */
export const DEFAULT_SALON_ID = 'salon_1';
