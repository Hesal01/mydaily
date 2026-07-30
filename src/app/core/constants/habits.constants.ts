import { HabitId } from '../models/habit.model';

export interface HabitConfig {
  id: HabitId;
  icon: string;
  name: string;
  description: string;
  color: string;
  maxCount?: number;
}

export const HABITS: readonly HabitConfig[] = [
  {
    id: 'sun',
    icon: 'sun',
    name: 'Soleil',
    description: 'Exposition au soleil',
    color: '#f4b942'
  },
  {
    id: 'doubleSun',
    icon: 'sun-horizon',
    name: 'Double Soleil',
    description: 'Double exposition',
    color: '#e87a00'
  },
  {
    id: 'book',
    icon: 'book-open',
    name: 'Lecture',
    description: 'Lire',
    color: '#3b82f6'
  },
  {
    id: 'three',
    icon: 'number-circle-three',
    name: 'Trois',
    description: 'Objectif 3',
    color: '#a855f7'
  },
  {
    id: 'network',
    icon: 'cell-signal-full',
    name: 'Réseau',
    description: 'Connexion sociale',
    color: '#10b981'
  },
  {
    id: 'study',
    icon: 'book-open-text',
    name: 'Étude',
    description: 'Étudier les versets de ma sourate',
    color: '#d97706'
  }
] as const;

export const HABIT_IDS: HabitId[] = HABITS.map(h => h.id);

export function getHabitConfig(id: HabitId): HabitConfig | undefined {
  return HABITS.find(h => h.id === id);
}

/**
 * Un badge identifie une personne dans la grille : soit des initiales définies
 * par le salon, soit l'emoji animal par défaut. Les deux ne se rendent pas
 * pareil — du texte a besoin d'être plus petit et gras qu'un emoji.
 */
export function isInitialsBadge(badge: string): boolean {
  return /^[A-Za-z]/.test(badge);
}

// Animal emojis assigned per user index (kept as emoji, not Phosphor)
export const USER_ICONS: readonly string[] = [
  '🦥',
  '🐘',
  '🦉',
  '🐈',
  '🐜',
  '🐆',
  '🐬',
  '🐇',
  '🐫'
];
