import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, orderBy, onSnapshot, doc, setDoc, serverTimestamp, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HabitDay, HabitId, HabitCompletions, RawHabitCompletions, createEmptyCompletions, normalizeCompletions } from '../models/habit.model';
import { User } from '../models/user.model';
import { DateService } from './date.service';
import { HABITS, getHabitConfig } from '../constants/habits.constants';

export interface DailyStat {
  habitId: HabitId;
  emoji: string;
  completed: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class HabitService {
  private firestore = inject(Firestore);
  private dateService = inject(DateService);

  getAllUsers(): Observable<User[]> {
    return new Observable<User[]>(subscriber => {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, orderBy('displayOrder', 'asc'));

      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as User));
          subscriber.next(users);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  getAllHabitsRealtime(): Observable<HabitDay[]> {
    const dates = this.dateService.getLast30Days();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    return new Observable<HabitDay[]>(subscriber => {
      const habitsRef = collection(this.firestore, 'habits');
      const q = query(
        habitsRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );

      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const habits = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              userId: data['userId'],
              date: data['date'],
              completions: normalizeCompletions(data['completions'] as RawHabitCompletions || {}),
              updatedAt: data['updatedAt']
            } as HabitDay;
          });
          subscriber.next(habits);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  getCompletionsForUserAndDate(habits: HabitDay[], userId: string, date: string): HabitCompletions {
    const found = habits.find(h => h.userId === userId && h.date === date);
    return found?.completions ?? createEmptyCompletions();
  }

  async toggleHabit(userId: string, date: string, habitId: HabitId, currentCompletions: HabitCompletions): Promise<void> {
    const docId = `${date}_${userId}`;
    const docRef = doc(this.firestore, 'habits', docId);

    const habitConfig = getHabitConfig(habitId);
    let newValue: boolean | number;

    if (habitConfig?.maxCount) {
      // Countable habit: increment and cycle
      const currentCount = (currentCompletions[habitId] as number) || 0;
      newValue = (currentCount + 1) % (habitConfig.maxCount + 1);
    } else {
      // Boolean habit: toggle
      newValue = !currentCompletions[habitId];
    }

    const newCompletions = {
      ...currentCompletions,
      [habitId]: newValue
    };

    // Clear legacy doubleBook field when updating book
    const firestoreCompletions: Record<string, boolean | number> = { ...newCompletions };
    if (habitId === 'book') {
      firestoreCompletions['doubleBook'] = false;
    }

    await setDoc(docRef, {
      userId,
      date,
      completions: firestoreCompletions,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  computeDailyStats(habits: HabitDay[], date: string, totalUsers: number): DailyStat[] {
    const todayHabits = habits.filter(h => h.date === date);

    return HABITS.map(habit => {
      const completed = todayHabits.filter(h => h.completions[habit.id]).length;
      return {
        habitId: habit.id,
        emoji: habit.emoji,
        completed,
        total: totalUsers
      };
    });
  }
}
