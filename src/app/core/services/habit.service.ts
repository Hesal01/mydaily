import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, orderBy, onSnapshot, doc, setDoc, serverTimestamp, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HabitDay, HabitId, HabitCompletions, createEmptyCompletions } from '../models/habit.model';
import { User } from '../models/user.model';
import { DateService } from './date.service';
import { HABITS } from '../constants/habits.constants';

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
          const habits = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as HabitDay));
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

    const habit = HABITS.find(h => h.id === habitId);
    const maxCount = habit?.maxCount ?? 1;
    const currentCount = currentCompletions[habitId] || 0;
    const newCount = (currentCount + 1) % (maxCount + 1);

    const newCompletions = {
      ...currentCompletions,
      [habitId]: newCount
    };

    await setDoc(docRef, {
      userId,
      date,
      completions: newCompletions,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  computeDailyStats(habits: HabitDay[], date: string, totalUsers: number): DailyStat[] {
    const todayHabits = habits.filter(h => h.date === date);

    return HABITS.map(habit => {
      const completed = todayHabits.filter(h => (h.completions[habit.id] || 0) > 0).length;
      return {
        habitId: habit.id,
        emoji: habit.emoji,
        completed,
        total: totalUsers
      };
    });
  }
}
