import { Component, input, output, computed } from '@angular/core';
import { HABITS } from '../../../core/constants/habits.constants';
import { HabitCompletions, HabitId } from '../../../core/models/habit.model';

@Component({
  selector: 'app-habit-buttons',
  standalone: true,
  template: `
    <div class="control">
      <div class="info-row">
        <span class="info-date">{{ infoDate() }}</span>
        <span class="info-dot">·</span>
        <span class="info-count" [class.full]="completedCount() === habits.length">
          {{ completedCount() }} / {{ habits.length }} fait
        </span>
      </div>

      <div class="buttons-row">
        @for (habit of habits; track habit.id) {
          <button
            class="habit-btn"
            [class.completed]="isCompleted(habit.id)"
            [class.disabled]="!canEdit()"
            [disabled]="!canEdit()"
            [style.--habit-color]="habit.color"
            (click)="onToggle(habit.id)"
            [attr.aria-label]="habit.name"
          >
            <span class="icon-wrap">
              <i class="ph ph-{{ habit.icon }} icon"></i>
              @if (habit.id === 'book' && bookPages() > 0) {
                <span class="badge">{{ bookPages() }}</span>
              }
            </span>
            <span class="label">{{ habit.name }}</span>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .control {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .info-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      color: var(--color-text-muted);
      text-transform: capitalize;
    }
    .info-dot { opacity: 0.5; }
    .info-count {
      font-weight: 600;
      color: var(--color-text);
    }
    .info-count.full { color: var(--color-success-dark); }

    .buttons-row {
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
    .habit-btn {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 10px 4px 8px;
      border-radius: var(--radius-md);
      border: 1.5px solid var(--color-border);
      background: var(--color-bg);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: transform var(--duration-fast) var(--spring),
                  background var(--duration-base) ease,
                  border-color var(--duration-base) ease,
                  color var(--duration-base) ease,
                  box-shadow var(--duration-base) ease;
      touch-action: manipulation;
      position: relative;
      -webkit-user-select: none;
      user-select: none;
    }
    .habit-btn:active:not(:disabled) {
      transform: scale(0.93);
    }
    .habit-btn.completed {
      background: color-mix(in srgb, var(--habit-color) 12%, white);
      border-color: var(--habit-color);
      color: var(--habit-color);
      animation: ring-pulse 0.6s ease-out;
    }
    .habit-btn.completed .label {
      color: var(--habit-color);
      font-weight: 600;
    }
    .habit-btn.disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .icon-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .icon {
      font-size: 26px;
      line-height: 1;
      display: inline-block;
    }
    .habit-btn.completed .icon {
      animation: pop 0.35s var(--spring);
    }
    .badge {
      position: absolute;
      top: -10px;
      right: -16px;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      background: var(--habit-color, var(--color-success-dark));
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      border-radius: var(--radius-pill);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-card);
      letter-spacing: -0.2px;
    }
    .label {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: -0.1px;
    }
  `]
})
export class HabitButtonsComponent {
  readonly completions = input.required<HabitCompletions>();
  readonly canEdit = input.required<boolean>();
  readonly infoDate = input.required<string>();

  readonly habits = HABITS;

  readonly toggleHabit = output<HabitId>();

  readonly bookPages = computed(() => this.completions().bookPages ?? 0);

  readonly completedCount = computed(() => {
    const c = this.completions();
    return this.habits.reduce((n, habit) => (c[habit.id] ? n + 1 : n), 0);
  });

  isCompleted(habitId: HabitId): boolean {
    return !!this.completions()[habitId];
  }

  onToggle(habitId: HabitId): void {
    if (this.canEdit()) {
      this.toggleHabit.emit(habitId);
    }
  }
}
