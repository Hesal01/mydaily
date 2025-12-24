import { Component, inject, computed, effect, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HabitButtonsComponent } from './components/habit-buttons.component';
import { InstallPromptComponent } from '../../shared/components/install-prompt.component';
import { AuthService } from '../../core/services/auth.service';
import { HabitService } from '../../core/services/habit.service';
import { DateService } from '../../core/services/date.service';
import { NotificationService } from '../../core/services/notification.service';
import { HabitId, HabitCompletions, createEmptyCompletions } from '../../core/models/habit.model';
import { HABITS } from '../../core/constants/habits.constants';

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
              @for (date of dates(); track date) {
                @for (user of users(); track user.id) {
                  <div
                    class="cell"
                    [class.mine]="user.id === currentUserId()"
                    [class.today]="date === today"
                    [class.selected]="date === selectedDate()"
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

            <!-- Day navigation header -->
            <div class="day-navigation">
              <button class="nav-arrow" (click)="navigateToPreviousDay()">
                ‹
              </button>
              <button class="date-display" [class.is-today]="isSelectedDateToday()" (click)="resetToToday()">
                {{ selectedDateDisplay() }}
              </button>
              <button class="nav-arrow" [class.disabled]="!canNavigateNext()" [disabled]="!canNavigateNext()" (click)="navigateToNextDay()">
                ›
              </button>
            </div>

            <!-- Swipeable emoji bars -->
            <div class="emoji-bars"
                 [style.grid-template-columns]="'repeat(' + users().length + ', 1fr)'"
                 (touchstart)="onTouchStart($event)"
                 (touchend)="onTouchEnd($event)">
              @for (userData of selectedDateCompletions(); track userData.userId) {
                <div class="emoji-bar-container">
                  <div class="emoji-bar" [class.mine]="userData.userId === currentUserId()">
                    @for (emoji of getCompletedEmojis(userData.completions); track emoji; let i = $index) {
                      <span class="stacked-emoji" [style.background-color]="emojiColors[i % emojiColors.length]">{{ emoji }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Fixed control zone -->
        <div class="control-zone">
          <app-habit-buttons
            [completions]="selectedDateUserCompletions()"
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
    .cell.selected {
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
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

    /* Day navigation */
    .day-navigation {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 16px;
      margin-bottom: 12px;
    }
    .nav-arrow {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid #d0d7de;
      background: #ffffff;
      color: #1f2328;
      font-size: 20px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .nav-arrow:active {
      background: #f6f8fa;
    }
    .nav-arrow.disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .date-display {
      min-width: 100px;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid #d0d7de;
      background: #f6f8fa;
      color: #1f2328;
      font-size: 14px;
      font-weight: 500;
      text-transform: capitalize;
      cursor: pointer;
    }
    .date-display.is-today {
      background: #2da44e;
      border-color: #2da44e;
      color: #ffffff;
    }

    /* Emoji bars */
    .emoji-bars {
      display: grid;
      gap: 4px;
      padding-bottom: 16px;
    }
    .emoji-bar-container {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
    }
    .emoji-bar {
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      gap: 2px;
    }
    .stacked-emoji {
      font-size: 16px;
      padding: 4px;
      border-radius: 8px;
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
    }, { allowSignalWrites: true });
  }
  readonly today = this.dateService.getToday();

  // Day navigation state
  readonly selectedDate = signal<string>(this.today);
  readonly dates = computed(() => this.dateService.getWeekForDate(this.selectedDate()));

  readonly users = toSignal(this.habitService.getAllUsers(), { initialValue: [] });
  readonly habits = toSignal(this.habitService.getAllHabitsRealtime(), { initialValue: [] });

  readonly loading = computed(() => this.users().length === 0);

  readonly animals = ['🦥', '🐘', '🦉', '🐈', '🐜', '🐆', '🐬', '🐇', '🐫'];

  // GitHub light mode colors (7 levels for 0-6 habits)
  readonly legendColors = ['#ebedf0', '#c6e48b', '#7bc96f', '#49af5d', '#2e8b47', '#1e6823', '#155a1c'];

  // Colors for stacked emojis
  readonly emojiColors = ['#fce4ec', '#e3f2fd', '#e8f5e9', '#fff3e0', '#f3e5f5', '#e0f7fa'];

  readonly canEdit = computed(() => this.currentUserId() !== null);

  readonly selectedDateUserCompletions = computed((): HabitCompletions => {
    const userId = this.currentUserId();
    if (!userId) return createEmptyCompletions();
    return this.habitService.getCompletionsForUserAndDate(this.habits(), userId, this.selectedDate());
  });

  readonly todayAllUsersCompletions = computed(() => {
    return this.users().map(user => ({
      userId: user.id,
      completions: this.habitService.getCompletionsForUserAndDate(
        this.habits(),
        user.id,
        this.today
      )
    }));
  });

  readonly selectedDateCompletions = computed(() => {
    return this.users().map(user => ({
      userId: user.id,
      completions: this.habitService.getCompletionsForUserAndDate(
        this.habits(),
        user.id,
        this.selectedDate()
      )
    }));
  });

  readonly selectedDateDisplay = computed(() => {
    const date = this.selectedDate();
    return `${this.dateService.formatDayName(date)} ${this.dateService.formatDisplayDate(date)}`;
  });

  readonly isSelectedDateToday = computed(() => this.selectedDate() === this.today);

  readonly canNavigateNext = computed(() => this.selectedDate() !== this.today);

  getCompletedEmojis(completions: HabitCompletions): string[] {
    return HABITS.filter(h => completions[h.id]).map(h => h.emoji);
  }

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
      this.selectedDate(),
      habitId,
      this.selectedDateUserCompletions()
    );
  }

  // Day navigation methods
  navigateToPreviousDay(): void {
    const current = new Date(this.selectedDate());
    current.setDate(current.getDate() - 1);
    this.selectedDate.set(this.dateService.formatDate(current));
  }

  navigateToNextDay(): void {
    if (this.canNavigateNext()) {
      const current = new Date(this.selectedDate());
      current.setDate(current.getDate() + 1);
      this.selectedDate.set(this.dateService.formatDate(current));
    }
  }

  resetToToday(): void {
    this.selectedDate.set(this.today);
  }

  // Swipe handling
  private touchStartX = 0;
  private touchStartY = 0;
  private readonly SWIPE_THRESHOLD = 50;

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent): void {
    const deltaX = event.changedTouches[0].clientX - this.touchStartX;
    const deltaY = event.changedTouches[0].clientY - this.touchStartY;

    // Horizontal swipe only
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        this.navigateToPreviousDay(); // Swipe left = previous day
      } else if (this.canNavigateNext()) {
        this.navigateToNextDay(); // Swipe right = next day
      }
    }
  }
}
