import { Component, inject, computed, effect, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HabitButtonsComponent } from './components/habit-buttons.component';
import { QuranModalComponent } from './components/quran-modal.component';
import { QuranProgressComponent } from './components/quran-progress.component';
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
  imports: [HabitButtonsComponent, QuranModalComponent, QuranProgressComponent, InstallPromptComponent],
  template: `
    <div class="container">
      @if (loading()) {
        <div class="loading">
          <div class="spinner"></div>
        </div>
      } @else {
        <!-- Swipeable screens wrapper -->
        <div class="screens-viewport"
             (touchstart)="onScreenTouchStart($event)"
             (touchend)="onScreenTouchEnd($event)">
          <div class="screens-track" [style.transform]="'translateX(' + (-currentScreen() * 100) + '%)'">
            <!-- Screen 0: Habits grid -->
            <div class="screen">
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

                  <!-- Emoji bars -->
                  <div class="emoji-bars"
                       [style.grid-template-columns]="'repeat(' + users().length + ', 1fr)'">
                    @for (userData of selectedDateCompletions(); track userData.userId) {
                      <div class="emoji-bar-container">
                        <div class="emoji-bar" [class.mine]="userData.userId === currentUserId()">
                          @for (item of getCompletedEmojis(userData.completions); track item.emoji; let i = $index) {
                            <span class="stacked-emoji" [style.background-color]="emojiColors[i % emojiColors.length]">
                              {{ item.emoji }}
                            </span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>

            <!-- Screen 1: Quran progress -->
            <div class="screen">
              <div class="calendar-zone">
                <app-quran-progress
                  [users]="users()"
                  [animals]="animals"
                  [currentUserId]="currentUserId()"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Screen dots -->
        <div class="screen-dots">
          <button class="dot" [class.active]="currentScreen() === 0" (click)="currentScreen.set(0)"></button>
          <button class="dot" [class.active]="currentScreen() === 1" (click)="currentScreen.set(1)"></button>
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

      <!-- Quran modal -->
      @if (showQuranModal()) {
        <app-quran-modal
          [currentPage]="currentUserQuranPage()"
          [currentCycle]="currentUserQuranCycle()"
          (pageChanged)="onQuranPageChanged($event)"
          (cycleChanged)="onQuranCycleChanged($event)"
          (close)="showQuranModal.set(false)"
        />
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

    /* Swipeable screens */
    .screens-viewport {
      flex: 1;
      overflow: hidden;
      position: relative;
    }
    .screens-track {
      display: flex;
      height: 100%;
      transition: transform 0.3s ease;
    }
    .screen {
      min-width: 100%;
      height: 100%;
      overflow-y: auto;
    }

    /* Scrollable calendar zone */
    .calendar-zone {
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
      position: relative;
    }

    /* Screen dots */
    .screen-dots {
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 8px 0;
      flex-shrink: 0;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1.5px solid #d0d7de;
      background: transparent;
      padding: 0;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .dot.active {
      background: #2da44e;
      border-color: #2da44e;
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

  // Screen navigation (0 = habits, 1 = quran)
  readonly currentScreen = signal(0);
  readonly showQuranModal = signal(false);

  // Day navigation state
  readonly selectedDate = signal<string>(this.today);
  readonly dates = computed(() => this.dateService.getWeekForDate(this.selectedDate()));

  readonly users = toSignal(this.habitService.getAllUsers(), { initialValue: [] });
  readonly habits = toSignal(this.habitService.getAllHabitsRealtime(), { initialValue: [] });

  readonly loading = computed(() => this.users().length === 0);

  readonly animals = ['🦥', '🐘', '🦉', '🐈', '🐜', '🐆', '🐬', '🐇', '🐫'];

  // GitHub light mode colors (6 levels for 0-5 habits)
  readonly legendColors = ['#ebedf0', '#c6e48b', '#7bc96f', '#49af5d', '#2e8b47', '#1e6823'];

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

  readonly currentUserQuranPage = computed(() => {
    const userId = this.currentUserId();
    if (!userId) return 0;
    const user = this.users().find(u => u.id === userId);
    return user?.quranPage || 0;
  });

  readonly currentUserQuranCycle = computed(() => {
    const userId = this.currentUserId();
    if (!userId) return 0;
    const user = this.users().find(u => u.id === userId);
    return user?.quranCycle || 0;
  });

  getCompletedEmojis(completions: HabitCompletions): { emoji: string }[] {
    const result: { emoji: string }[] = [];
    for (const habit of HABITS) {
      if (completions[habit.id]) {
        result.push({ emoji: habit.emoji });
      }
    }
    return result;
  }

  getCompletions(userId: string, date: string): HabitCompletions {
    return this.habitService.getCompletionsForUserAndDate(this.habits(), userId, date);
  }

  getCellColor(userId: string, date: string): string {
    const completions = this.getCompletions(userId, date);
    let count = 0;
    if (completions.sun) count++;
    if (completions.doubleSun) count++;
    if (completions.book) count++;
    if (completions.three) count++;
    if (completions.network) count++;
    return this.legendColors[Math.min(count, 5)];
  }

  async onToggleHabit(habitId: HabitId): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;

    if (habitId === 'book') {
      this.showQuranModal.set(true);
      return;
    }

    await this.habitService.toggleHabit(
      userId,
      this.selectedDate(),
      habitId,
      this.selectedDateUserCompletions()
    );
  }

  async onQuranPageChanged(page: number): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;

    await this.habitService.updateQuranPage(userId, page);
    // Also mark book as done for today
    await this.habitService.markBookForToday(
      userId,
      this.selectedDate(),
      this.selectedDateUserCompletions()
    );
  }

  async onQuranCycleChanged(cycle: number): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;

    await this.habitService.updateQuranCycle(userId, cycle);
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

  // Screen swipe handling
  private screenTouchStartX = 0;
  private screenTouchStartY = 0;
  private readonly SWIPE_THRESHOLD = 50;

  onScreenTouchStart(event: TouchEvent): void {
    this.screenTouchStartX = event.touches[0].clientX;
    this.screenTouchStartY = event.touches[0].clientY;
  }

  onScreenTouchEnd(event: TouchEvent): void {
    const deltaX = event.changedTouches[0].clientX - this.screenTouchStartX;
    const deltaY = event.changedTouches[0].clientY - this.screenTouchStartY;

    // Horizontal swipe only
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.SWIPE_THRESHOLD) {
      if (deltaX < 0 && this.currentScreen() === 0) {
        this.currentScreen.set(1); // Swipe left → quran screen
      } else if (deltaX > 0 && this.currentScreen() === 1) {
        this.currentScreen.set(0); // Swipe right → habits screen
      }
    }
  }
}
