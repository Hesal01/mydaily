import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DateService {

  getLast30Days(): string[] {
    const dates: string[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(this.formatDate(date));
    }

    return dates;
  }

  getCurrentWeek(): string[] {
    return this.getWeekByOffset(0);
  }

  getWeekByOffset(weekOffset: number): string[] {
    const dates: string[] = [];
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...

    // Calculate Monday of current week
    const monday = new Date(today);
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(today.getDate() - daysFromMonday);

    // Apply week offset
    monday.setDate(monday.getDate() + (weekOffset * 7));

    // Generate Monday to Sunday
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(this.formatDate(date));
    }

    return dates;
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  formatDisplayDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  formatDayName(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  }

  isToday(dateStr: string): boolean {
    return dateStr === this.formatDate(new Date());
  }

  getToday(): string {
    return this.formatDate(new Date());
  }

  getWeekForDate(dateStr: string): string[] {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(date.getDate() - daysFromMonday);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(this.formatDate(d));
    }
    return dates;
  }
}
