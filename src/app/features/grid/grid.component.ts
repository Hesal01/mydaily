import { Component, inject, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HabitButtonsComponent } from './components/habit-buttons.component';
import { InstallPromptComponent } from '../../shared/components/install-prompt.component';
import { AuthService } from '../../core/services/auth.service';
import { HabitService } from '../../core/services/habit.service';
import { DateService } from '../../core/services/date.service';
import { NotificationService } from '../../core/services/notification.service';
import { HabitId, HabitCompletions, createEmptyCompletions } from '../../core/models/habit.model';

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [HabitButtonsComponent, InstallPromptComponent],
  template: `
    <div class="container">
      @if (loading()) {
        <div class="loading">
          <div class="spinner"></div>
        </div>
      } @else {
        <!-- Scrollable calendar zone -->
        <div class="calendar-zone">
          <div class="graph">
            <!-- Animal header -->
            <div class="animal-header" [style.grid-template-columns]="'repeat(' + users().length + ', 1fr)'">
              @for (user of users(); track user.id; let i = $index) {
                <div class="animal" [class.mine]="user.id === currentUserId()">
                  {{ animals[i] }}
                </div>
              }
            </div>

            <!-- Grid -->
            <div class="grid" [style.grid-template-columns]="'repeat(' + users().length + ', 1fr)'">
              @for (date of dates; track date) {
                @for (user of users(); track user.id) {
                  <div
                    class="cell"
                    [class.mine]="user.id === currentUserId()"
                    [class.today]="date === today"
                    [style.background-color]="getCellColor(user.id, date)"
                  ></div>
                }
              }
            </div>

            <div class="legend">
              <span>Less</span>
              @for (color of legendColors; track color) {
                <span class="legend-box" [style.background-color]="color"></span>
              }
              <span>More</span>
            </div>
          </div>
        </div>

        <!-- Fixed control zone -->
        <div class="control-zone">
          <app-habit-buttons
            [completions]="todayCompletions()"
            [canEdit]="canEdit()"
            (toggleHabit)="onToggleHabit($event)"
          />
        </div>
      }

      <!-- iOS install prompt -->
      <app-install-prompt />
    </div>
  `,
  styles: [`
    .container {
      height: 100vh;
      height: 100dvh;
      background: #ffffff;
      color: #1f2328;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
    }
    .loading {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 2px solid #eaeef2;
      border-top-color: #216e39;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Scrollable calendar zone */
    .calendar-zone {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      padding-bottom: 0;
    }
    .graph {
      width: 100%;
    }
    .animal-header {
      display: grid;
      gap: 4px;
      margin-bottom: 8px;
      position: sticky;
      top: 0;
      background: #ffffff;
      padding-bottom: 4px;
      z-index: 10;
    }
    .animal {
      text-align: center;
      font-size: 22px;
      opacity: 0.5;
    }
    .animal.mine {
      opacity: 1;
      transform: scale(1.15);
    }
    .grid {
      display: grid;
      gap: 4px;
    }
    .cell {
      aspect-ratio: 1;
      border-radius: 4px;
    }
    .cell.mine {
      filter: brightness(0.92);
    }
    .legend {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 16px;
      padding-bottom: 16px;
      font-size: 12px;
      color: #656d76;
    }
    .legend span:first-child {
      margin-right: 4px;
    }
    .legend span:last-child {
      margin-left: 4px;
    }
    .legend-box {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    /* Fixed control zone */
    .control-zone {
      flex-shrink: 0;
      background: #f6f8fa;
      border-top: 1px solid #d0d7de;
      padding: 24px 16px;
      padding-bottom: max(32px, env(safe-area-inset-bottom));
    }
  `]
})
export class GridComponent {
  private authService = inject(AuthService);
  private habitService = inject(HabitService);
  private dateService = inject(DateService);
  private notificationService = inject(NotificationService);

  readonly currentUserId = this.authService.userId;

  constructor() {
    // Request notification permission when user is logged in
    effect(() => {
      const userId = this.currentUserId();
      if (userId) {
        this.notificationService.requestPermissionAndSaveToken(userId);
        this.notificationService.listenForMessages();
      }
    });
  }
  readonly dates = this.dateService.getCurrentWeek();
  readonly today = this.dateService.getToday();

  readonly users = toSignal(this.habitService.getAllUsers(), { initialValue: [] });
  readonly habits = toSignal(this.habitService.getAllHabitsRealtime(), { initialValue: [] });

  readonly loading = computed(() => this.users().length === 0);

  readonly animals = ['🦥', '🐘', '🦉', '🐈', '🐜', '🐆', '🐬', '🐇', '🐫'];

  // GitHub light mode colors (7 levels for 0-6 habits)
  readonly legendColors = ['#ebedf0', '#c6e48b', '#7bc96f', '#49af5d', '#2e8b47', '#1e6823', '#155a1c'];

  readonly canEdit = computed(() => this.currentUserId() !== null);

  readonly todayCompletions = computed((): HabitCompletions => {
    const userId = this.currentUserId();
    if (!userId) return createEmptyCompletions();
    return this.habitService.getCompletionsForUserAndDate(this.habits(), userId, this.today);
  });

  getCompletions(userId: string, date: string): HabitCompletions {
    return this.habitService.getCompletionsForUserAndDate(this.habits(), userId, date);
  }

  getCellColor(userId: string, date: string): string {
    const completions = this.getCompletions(userId, date);
    const count = [completions.sun, completions.doubleSun, completions.book, completions.doubleBook, completions.three, completions.network].filter(Boolean).length;
    return this.legendColors[Math.min(count, 6)];
  }

  async onToggleHabit(habitId: HabitId): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;

    await this.habitService.toggleHabit(
      userId,
      this.today,
      habitId,
      this.todayCompletions()
    );
  }
}
