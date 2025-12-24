import { HabitId } from '../models/habit.model';

export interface HabitConfig {
  id: HabitId;
  emoji: string;
  name: string;
  description: string;
  maxCount?: number; // For countable habits (multi-click)
}

export const HABITS: readonly HabitConfig[] = [
  {
    id: 'sun',
    emoji: '☀️',
    name: 'Soleil',
    description: 'Exposition au soleil'
  },
  {
    id: 'doubleSun',
    emoji: '☀️☀️',
    name: 'Double Soleil',
    description: 'Double exposition'
  },
  {
    id: 'book',
    emoji: '📖',
    name: 'Lecture',
    description: 'Lire',
    maxCount: 5
  },
  {
    id: 'three',
    emoji: '3️⃣',
    name: 'Trois',
    description: 'Objectif 3'
  },
  {
    id: 'network',
    emoji: '🌐',
    name: 'Réseau',
    description: 'Connexion sociale'
  }
] as const;

export const HABIT_IDS: HabitId[] = HABITS.map(h => h.id);

export function getHabitConfig(id: HabitId): HabitConfig | undefined {
  return HABITS.find(h => h.id === id);
}
