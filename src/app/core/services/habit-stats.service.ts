import { Injectable, inject } from '@angular/core';
import { HabitDay, HabitId, HabitCompletions } from '../models/habit.model';
import { HABITS } from '../constants/habits.constants';
import { DateService } from './date.service';
import { User } from '../models/user.model';

export interface DayCellStat {
  date: string;
  count: number;
  bookPages: number;
}

export interface LeaderRow {
  userId: string;
  value: number;
}

@Injectable({ providedIn: 'root' })
export class HabitStatsService {
  private dateService = inject(DateService);

  private countDone(c: HabitCompletions): number {
    let n = 0;
    if (c.sun) n++;
    if (c.doubleSun) n++;
    if (c.book) n++;
    if (c.three) n++;
    if (c.network) n++;
    return n;
  }

  private getCompletionsFor(habits: HabitDay[], userId: string, date: string): HabitCompletions | null {
    return habits.find(h => h.userId === userId && h.date === date)?.completions ?? null;
  }

  private isDayDone(habits: HabitDay[], userId: string, date: string, habitId: HabitId | 'any'): boolean {
    const c = this.getCompletionsFor(habits, userId, date);
    if (!c) return false;
    if (habitId === 'any') return this.countDone(c) > 0;
    return !!c[habitId];
  }

  /**
   * Current streak ending today (or yesterday if today not yet done).
   * Counts consecutive days where the habit was done.
   */
  getCurrentStreak(habits: HabitDay[], userId: string, habitId: HabitId | 'any'): number {
    const today = this.dateService.getToday();
    let streak = 0;
    const d = new Date(today);
    let allowSkipToday = true;
    while (true) {
      const dateStr = this.dateService.formatDate(d);
      const done = this.isDayDone(habits, userId, dateStr, habitId);
      if (done) {
        streak++;
        allowSkipToday = false;
      } else {
        if (allowSkipToday && dateStr === today) {
          // Today not yet done — start counting from yesterday
          allowSkipToday = false;
        } else {
          break;
        }
      }
      d.setDate(d.getDate() - 1);
      if (streak > 730) break; // safety
    }
    return streak;
  }

  /**
   * Longest streak within the data set.
   */
  getLongestStreak(habits: HabitDay[], userId: string, habitId: HabitId | 'any'): number {
    const userDays = habits
      .filter(h => h.userId === userId)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (userDays.length === 0) return 0;

    let longest = 0;
    let current = 0;
    let prevDate: Date | null = null;

    for (const day of userDays) {
      const done = habitId === 'any' ? this.countDone(day.completions) > 0 : !!day.completions[habitId];
      const date = new Date(day.date);
      if (done) {
        if (prevDate) {
          const diffMs = date.getTime() - prevDate.getTime();
          const diffDays = Math.round(diffMs / 86400000);
          current = diffDays === 1 ? current + 1 : 1;
        } else {
          current = 1;
        }
        prevDate = date;
        if (current > longest) longest = current;
      } else {
        current = 0;
        prevDate = null;
      }
    }
    return longest;
  }

  /**
   * Per-habit completion count for the last N days for a user.
   */
  getWeekCompletion(habits: HabitDay[], userId: string, daysBack = 7): Record<HabitId, number> {
    const dates = this.dateService.getLastNDays(daysBack);
    const result: Record<string, number> = { sun: 0, doubleSun: 0, book: 0, three: 0, network: 0 };
    for (const date of dates) {
      const c = this.getCompletionsFor(habits, userId, date);
      if (!c) continue;
      for (const h of HABITS) {
        if (c[h.id]) result[h.id]++;
      }
    }
    return result as Record<HabitId, number>;
  }

  /**
   * Pages read per day for the last N days for a user.
   */
  getPagesPerDay(habits: HabitDay[], userId: string, daysBack = 30): { date: string; pages: number }[] {
    const dates = this.dateService.getLastNDays(daysBack);
    return dates.map(date => ({
      date,
      pages: this.getCompletionsFor(habits, userId, date)?.bookPages ?? 0
    }));
  }

  /**
   * Total pages read in last N days (sum of bookPages on HabitDay records).
   */
  getTotalPages(habits: HabitDay[], userId: string, daysBack = 30): number {
    return this.getPagesPerDay(habits, userId, daysBack).reduce((sum, d) => sum + d.pages, 0);
  }

  /**
   * Year heatmap data: { date, count, bookPages } for last N days.
   */
  getYearHeatmap(habits: HabitDay[], userId: string, daysBack = 365): DayCellStat[] {
    const dates = this.dateService.getLastNDays(daysBack);
    return dates.map(date => {
      const c = this.getCompletionsFor(habits, userId, date);
      return {
        date,
        count: c ? this.countDone(c) : 0,
        bookPages: c?.bookPages ?? 0
      };
    });
  }

  /**
   * Year heatmap for a single habit: binary done/not-done.
   */
  getYearHeatmapForHabit(habits: HabitDay[], userId: string, habitId: HabitId, daysBack = 365): DayCellStat[] {
    const dates = this.dateService.getLastNDays(daysBack);
    return dates.map(date => {
      const c = this.getCompletionsFor(habits, userId, date);
      const done = c ? !!c[habitId] : false;
      return {
        date,
        count: done ? 1 : 0,
        bookPages: c?.bookPages ?? 0
      };
    });
  }

  /**
   * Leaderboard: total completions of a habit per user over last N days.
   */
  getHabitLeaderboard(habits: HabitDay[], users: User[], habitId: HabitId, daysBack = 30): LeaderRow[] {
    const dates = new Set(this.dateService.getLastNDays(daysBack));
    const counts: Record<string, number> = {};
    for (const u of users) counts[u.id] = 0;
    for (const h of habits) {
      if (!dates.has(h.date)) continue;
      if (h.completions[habitId]) counts[h.userId] = (counts[h.userId] ?? 0) + 1;
    }
    return users
      .map(u => ({ userId: u.id, value: counts[u.id] ?? 0 }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Total habits done across all 5 habits over last N days.
   */
  getTotalHabitsLeaderboard(habits: HabitDay[], users: User[], daysBack = 30): LeaderRow[] {
    const dates = new Set(this.dateService.getLastNDays(daysBack));
    const counts: Record<string, number> = {};
    for (const u of users) counts[u.id] = 0;
    for (const h of habits) {
      if (!dates.has(h.date)) continue;
      counts[h.userId] = (counts[h.userId] ?? 0) + this.countDone(h.completions);
    }
    return users
      .map(u => ({ userId: u.id, value: counts[u.id] ?? 0 }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Total pages read leaderboard over last N days.
   */
  getPagesLeaderboard(habits: HabitDay[], users: User[], daysBack = 30): LeaderRow[] {
    const dates = new Set(this.dateService.getLastNDays(daysBack));
    const counts: Record<string, number> = {};
    for (const u of users) counts[u.id] = 0;
    for (const h of habits) {
      if (!dates.has(h.date)) continue;
      counts[h.userId] = (counts[h.userId] ?? 0) + (h.completions.bookPages ?? 0);
    }
    return users
      .map(u => ({ userId: u.id, value: counts[u.id] ?? 0 }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Cumulative Quran page leaderboard (current value on User).
   */
  getQuranLeaderboard(users: User[]): LeaderRow[] {
    return users
      .map(u => ({ userId: u.id, value: (u.quranCycle ?? 0) * 604 + (u.quranPage ?? 0) }))
      .sort((a, b) => b.value - a.value);
  }
}
