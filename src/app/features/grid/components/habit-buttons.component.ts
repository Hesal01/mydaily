import { Component, input, output } from '@angular/core';
import { HABITS } from '../../../core/constants/habits.constants';
import { HabitCompletions, HabitId } from '../../../core/models/habit.model';

@Component({
  selector: 'app-habit-buttons',
  standalone: true,
  template: `
    <div class="buttons-container">
      @for (habit of habits; track habit.id) {
        <button
          class="habit-btn"
          [class.completed]="completions()[habit.id]"
          [disabled]="!canEdit()"
          (click)="onToggle(habit.id)"
          [title]="habit.name"
        >
          {{ habit.emoji }}
        </button>
      }
    </div>
  `,
  styles: [`
    .buttons-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      max-width: 240px;
      margin: 0 auto;
    }
    .habit-btn {
      width: 64px;
      height: 64px;
      border-radius: 14px;
      border: 2px solid #d0d7de;
      background: #ffffff;
      font-size: 28px;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .habit-btn:hover:not(:disabled) {
      background: #f6f8fa;
      border-color: #8c959f;
    }
    .habit-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .habit-btn.completed {
      background: #2da44e;
      border-color: #2da44e;
    }
    .habit-btn.completed:hover:not(:disabled) {
      background: #218838;
      border-color: #218838;
    }
  `]
})
export class HabitButtonsComponent {
  readonly completions = input.required<HabitCompletions>();
  readonly canEdit = input.required<boolean>();

  readonly habits = HABITS;

  readonly toggleHabit = output<HabitId>();

  onToggle(habitId: HabitId): void {
    if (this.canEdit()) {
      this.toggleHabit.emit(habitId);
    }
  }
}
