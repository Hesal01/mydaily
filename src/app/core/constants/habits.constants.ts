import { HabitId } from '../models/habit.model';

export interface HabitConfig {
  id: HabitId;
  emoji: string;
  name: string;
  description: string;
  maxCount: number;
}

export const HABITS: readonly HabitConfig[] = [
  {
    id: 'sun',
    emoji: '☀️',
    name: 'Soleil',
    description: 'Exposition au soleil',
    maxCount: 2
  },
  {
    id: 'book',
    emoji: '📖',
    name: 'Lecture',
    description: 'Lire',
    maxCount: 2
  },
  {
    id: 'three',
    emoji: '3️⃣',
    name: 'Trois',
    description: 'Objectif 3',
    maxCount: 5
  },
  {
    id: 'network',
    emoji: '🌐',
    name: 'Réseau',
    description: 'Connexion sociale',
    maxCount: 2
  }
] as const;

export const HABIT_IDS: HabitId[] = HABITS.map(h => h.id);
