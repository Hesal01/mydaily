import { HabitId } from '../models/habit.model';

export interface HabitConfig {
  id: HabitId;
  emoji: string;
  name: string;
  description: string;
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
    description: 'Lire'
  },
  {
    id: 'doubleBook',
    emoji: '📖📖',
    name: 'Double Lecture',
    description: 'Lire plus'
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
