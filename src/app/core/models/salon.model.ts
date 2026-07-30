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
  createdAt?: Date;
}

/** Salon historique : celui qui existait avant l'introduction des salons. */
export const DEFAULT_SALON_ID = 'salon_1';
