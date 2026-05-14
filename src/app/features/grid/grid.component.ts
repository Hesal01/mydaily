import { Component, inject, computed, effect, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HabitButtonsComponent } from './components/habit-buttons.component';
import { QuranModalComponent } from './components/quran-modal.component';
import { QuranProgressComponent } from './components/quran-progress.component';
import { InstallPromptComponent } from '../../shared/components/install-prompt.component';
import { ToastComponent } from '../../shared/components/toast.component';
import { AuthService } from '../../core/services/auth.service';
import { HabitService } from '../../core/services/habit.service';
import { DateService } from '../../core/services/date.service';
import { NotificationService } from '../../core/services/notification.service';
import { HapticService } from '../../core/services/haptic.service';
import { ToastService } from '../../core/services/toast.service';
import { HabitId, HabitCompletions, createEmptyCompletions } from '../../core/models/habit.model';
import { HABITS, USER_ICONS, getHabitConfig } from '../../core/constants/habits.constants';

interface CompletionItem {
  icon: string;
  color: string;
  count?: number;
}

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [
    HabitButtonsComponent,
    QuranModalComponent,
    QuranProgressComponent,
    InstallPromptComponent,
    ToastComponent,
  ],
  template: `
    <div class="container">
      @if (loading()) {
        <div class="loading">
          <div class="spinner"></div>
        </div>
      } @else {
        <div class="screens-viewport"
             (touchstart)="onScreenTouchStart($event)"
             (touchend)="onScreenTouchEnd($event)">
          <div class="screens-track" [style.transform]="'translateX(' + (-currentScreen() * 100) + '%)'">
            <!-- Screen 0: Habits grid -->
            <div class="screen">
              <div class="calendar-zone">
                <div class="graph">
                  <!-- Filter bar (own horizontal scroll, doesn't bubble swipe) -->
                  <div class="filter-bar"
                       (touchstart)="$event.stopPropagation()"
                       (touchend)="$event.stopPropagation()"
                       (touchmove)="$event.stopPropagation()">
                    <button class="fchip" [class.active]="!filteredHabit()" (click)="setFilter(null)">
                      Tous
                    </button>
                    @for (h of habits; track h.id) {
                      <button
                        class="fchip"
                        [class.active]="filteredHabit() === h.id"
                        [style.--habit-color]="h.color"
                        (click)="setFilter(h.id)"
                      >
                        <i class="ph ph-{{ h.icon }} fchip-icon"></i>
                        <span class="fchip-label">{{ h.name }}</span>
                      </button>
                    }
                  </div>

                  <!-- Animals row (below filters) -->
                  <div class="animal-header" [style.grid-template-columns]="'repeat(' + users().length + ', 1fr)'">
                    @for (user of users(); track user.id; let i = $index) {
                      <div class="animal" [class.mine]="user.id === currentUserId()">
                        {{ animals[i] || '?' }}
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
                          [style.background-color]="cellColor(user.id, date)"
                        ></div>
                      }
                    }
                  </div>

                  <div class="legend">
                    @if (filteredHabit()) {
                      <span>Non fait</span>
                      <span class="legend-box" [style.background]="'#ebedf0'"></span>
                      <span class="legend-box" [style.background]="filteredHabitColor()"></span>
                      <span>Fait</span>
                    } @else {
                      <span>Less</span>
                      @for (color of legendColors; track color) {
                        <span class="legend-box" [style.background-color]="color"></span>
                      }
                      <span>More</span>
                    }
                  </div>

                  <div class="day-navigation">
                    <button class="nav-arrow" (click)="navigateToPreviousDay()" aria-label="Jour précédent">
                      <i class="ph ph-caret-left"></i>
                    </button>
                    <button class="date-display" [class.is-today]="isSelectedDateToday()" (click)="resetToToday()">
                      {{ selectedDateDisplay() }}
                      @if (!isSelectedDateToday()) {
                        <i class="ph ph-arrow-counter-clockwise reset-hint"></i>
                      }
                    </button>
                    <button class="nav-arrow" [class.disabled]="!canNavigateNext()" [disabled]="!canNavigateNext()" (click)="navigateToNextDay()" aria-label="Jour suivant">
                      <i class="ph ph-caret-right"></i>
                    </button>
                  </div>

                  <div class="icon-matrix" [style.grid-template-columns]="'repeat(' + users().length + ', 1fr)'">
                    @for (habit of habits; track habit.id; let hLast = $last) {
                      @for (userData of selectedDateCompletions(); track userData.userId; let cLast = $last) {
                        <div
                          class="mtx-cell"
                          [class.row-last]="hLast"
                          [class.col-last]="cLast"
                          [class.mine]="userData.userId === currentUserId()"
                          [class.done]="!!userData.completions[habit.id]"
                          [style.--habit-color]="habit.color"
                        >
                          @if (userData.completions[habit.id]) {
                            <i class="ph ph-{{ habit.icon }} mtx-ic"></i>
                            @if (habit.id === 'book' && (userData.completions.bookPages ?? 0) > 0) {
                              <span class="mtx-count">{{ userData.completions.bookPages }}</span>
                            }
                          }
                        </div>
                      }
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
                  [animals]="animalsArray"
                  [currentUserId]="currentUserId()"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="screen-dots">
          <button class="dot" [class.active]="currentScreen() === 0" (click)="currentScreen.set(0)" aria-label="Habitudes"></button>
          <button class="dot" [class.active]="currentScreen() === 1" (click)="currentScreen.set(1)" aria-label="Quran"></button>
        </div>

        <div class="control-zone">
          <app-habit-buttons
            [completions]="selectedDateUserCompletions()"
            [canEdit]="canEdit()"
            [infoDate]="selectedDateShort()"
            (toggleHabit)="onToggleHabit($event)"
          />
        </div>
      }

      @if (showQuranModal()) {
        <app-quran-modal
          [currentPage]="currentUserQuranPage()"
          [currentCycle]="currentUserQuranCycle()"
          (pageChanged)="onQuranPageChanged($event)"
          (cycleChanged)="onQuranCycleChanged($event)"
          (close)="showQuranModal.set(false)"
        />
      }

      <app-toast />
      <app-install-prompt />
    </div>
  `,
  styles: [`
    .container {
      height: 100vh;
      height: 100dvh;
      background: var(--color-bg);
      color: var(--color-text);
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
      border: 2px solid var(--color-surface-2);
      border-top-color: var(--color-success-darker);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .screens-viewport {
      flex: 1;
      overflow: hidden;
      position: relative;
    }
    .screens-track {
      display: flex;
      height: 100%;
      transition: transform var(--duration-slow) var(--ease-out);
    }
    .screen {
      min-width: 100%;
      height: 100%;
      overflow-y: auto;
    }

    .calendar-zone {
      padding: 16px;
      padding-bottom: 0;
    }
    .graph { width: 100%; }

    .filter-bar {
      display: flex;
      gap: 6px;
      padding: 4px 0 12px;
      overflow-x: auto;
      scrollbar-width: none;
      touch-action: pan-x;
    }
    .filter-bar::-webkit-scrollbar { display: none; }
    .fchip {
      flex-shrink: 0;
      padding: 6px 10px;
      border-radius: var(--radius-pill);
      border: 1.5px solid var(--color-border);
      background: var(--color-bg);
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      touch-action: manipulation;
      transition: transform var(--duration-fast) var(--spring), background var(--duration-base) ease;
    }
    .fchip:active { transform: scale(0.94); }
    .fchip.active {
      background: var(--habit-color, var(--color-text));
      color: #fff;
      border-color: var(--habit-color, var(--color-text));
    }
    .fchip-icon { font-size: 13px; line-height: 1; }
    .fchip-label { line-height: 1; }

    .animal-header {
      display: grid;
      gap: 4px;
      margin-bottom: 8px;
      position: sticky;
      top: 0;
      background: var(--color-bg);
      padding-bottom: 4px;
      z-index: 10;
    }
    .animal {
      text-align: center;
      font-size: 22px;
      line-height: 1;
      opacity: 0.55;
      transition: transform var(--duration-base) var(--spring), opacity var(--duration-base) ease;
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
      border-radius: var(--radius-xs);
      transition: background-color var(--duration-base) ease;
    }
    .cell.mine { filter: brightness(0.92); }
    .cell.selected { box-shadow: inset 0 0 0 1.5px rgba(0, 0, 0, 0.4); }
    .cell.today { outline: 1px solid var(--color-success-darker); outline-offset: -1px; }

    .legend {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 16px;
      padding-bottom: 12px;
      font-size: 11px;
      color: var(--color-text-muted);
      flex-wrap: wrap;
    }
    .legend-box {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .day-navigation {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 12px;
      margin-bottom: 12px;
    }
    .nav-arrow {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
      background: var(--color-bg);
      color: var(--color-text);
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform var(--duration-fast) var(--spring), background var(--duration-base) ease;
      touch-action: manipulation;
    }
    .nav-arrow:active:not(:disabled) {
      transform: scale(0.92);
      background: var(--color-surface-1);
    }
    .nav-arrow.disabled { opacity: 0.3; cursor: not-allowed; }
    .date-display {
      min-width: 100px;
      padding: 8px 16px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
      background: var(--color-surface-1);
      color: var(--color-text);
      font-size: 14px;
      font-weight: 500;
      text-transform: capitalize;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: transform var(--duration-fast) var(--spring), background var(--duration-base) ease;
      touch-action: manipulation;
    }
    .date-display:active { transform: scale(0.96); }
    .date-display.is-today {
      background: var(--color-success);
      border-color: var(--color-success);
      color: #fff;
    }
    .reset-hint { font-size: 13px; line-height: 1; opacity: 0.75; }

    .icon-matrix {
      display: grid;
      margin: 8px 0 16px;
      border-top: 1px solid var(--color-border);
      border-left: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: var(--color-bg);
    }
    .mtx-cell {
      min-height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      padding: 4px 2px;
      transition: background var(--duration-base) ease;
    }
    .mtx-cell.col-last { border-right: none; }
    .mtx-cell.row-last { border-bottom: none; }
    .mtx-cell.mine { background: color-mix(in srgb, var(--color-success) 6%, transparent); }
    .mtx-cell.done.mine { background: color-mix(in srgb, var(--habit-color) 10%, transparent); }
    .mtx-ic {
      font-size: 16px;
      line-height: 1;
      color: var(--habit-color);
    }
    .mtx-count {
      font-size: 10px;
      font-weight: 700;
      color: var(--habit-color);
      line-height: 1;
    }

    .screen-dots {
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 6px 0 4px;
      flex-shrink: 0;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1.5px solid var(--color-border);
      background: transparent;
      padding: 0;
      cursor: pointer;
      transition: all var(--duration-base) var(--spring);
    }
    .dot.active {
      background: var(--color-success);
      border-color: var(--color-success);
      transform: scale(1.2);
    }

    .control-zone {
      flex-shrink: 0;
      background: var(--color-bg);
      box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.06);
      padding: 14px 16px;
      padding-bottom: max(20px, env(safe-area-inset-bottom));
    }
  `]
})
export class GridComponent {
  private authService = inject(AuthService);
  private habitService = inject(HabitService);
  private dateService = inject(DateService);
  private notificationService = inject(NotificationService);
  private hapticService = inject(HapticService);
  private toastService = inject(ToastService);

  readonly currentUserId = this.authService.userId;
  readonly today = this.dateService.getToday();
  readonly habits = HABITS;
  readonly animals = USER_ICONS;
  readonly animalsArray = [...USER_ICONS];

  readonly filteredHabit = signal<HabitId | null>(null);

  readonly currentScreen = signal(0);
  readonly showQuranModal = signal(false);
  readonly selectedDate = signal<string>(this.today);
  readonly dates = computed(() => this.dateService.getWeekForDate(this.selectedDate()));

  readonly users = toSignal(this.habitService.getAllUsers(), { initialValue: [] });
  readonly habits$ = toSignal(this.habitService.getAllHabitsRealtime(), { initialValue: [] });

  private readonly optimisticOverlay = signal<Record<string, HabitCompletions>>({});
  private readonly writtenQuranPage = signal<number | null>(null);

  readonly loading = computed(() => this.users().length === 0);

  readonly legendColors = ['#ebedf0', '#c6e48b', '#7bc96f', '#49af5d', '#2e8b47', '#1e6823'];

  readonly canEdit = computed(() => this.currentUserId() !== null);

  readonly selectedDateUserCompletions = computed((): HabitCompletions => {
    const userId = this.currentUserId();
    if (!userId) return createEmptyCompletions();
    return this.getMergedCompletions(userId, this.selectedDate());
  });

  readonly selectedDateCompletions = computed(() => {
    return this.users().map(user => ({
      userId: user.id,
      completions: this.getMergedCompletions(user.id, this.selectedDate())
    }));
  });

  readonly selectedDateDisplay = computed(() => {
    const date = this.selectedDate();
    return `${this.dateService.formatDayName(date)} ${this.dateService.formatDisplayDate(date)}`;
  });

  readonly selectedDateShort = computed(() => {
    const date = this.selectedDate();
    if (date === this.today) return `Aujourd'hui · ${this.dateService.formatDisplayDate(date)}`;
    return `${this.dateService.formatDayName(date)} ${this.dateService.formatDisplayDate(date)}`;
  });

  readonly isSelectedDateToday = computed(() => this.selectedDate() === this.today);
  readonly canNavigateNext = computed(() => this.selectedDate() !== this.today);

  readonly currentUserQuranPage = computed(() => {
    const local = this.writtenQuranPage();
    if (local !== null) return local;
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

  constructor() {
    effect(() => {
      const userId = this.currentUserId();
      if (userId) {
        this.notificationService.requestPermissionAndSaveToken(userId);
        this.notificationService.listenForMessages();
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const habits = this.habits$();
      const overlay = this.optimisticOverlay();
      if (Object.keys(overlay).length === 0) return;
      const next: Record<string, HabitCompletions> = {};
      let changed = false;
      for (const [key, value] of Object.entries(overlay)) {
        const [userId, date] = key.split('|');
        const real = this.habitService.getCompletionsForUserAndDate(habits, userId, date);
        if (this.completionsEqual(real, value)) {
          changed = true;
        } else {
          next[key] = value;
        }
      }
      if (changed) {
        this.optimisticOverlay.set(next);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const written = this.writtenQuranPage();
      if (written === null) return;
      const userId = this.currentUserId();
      if (!userId) return;
      const fromFirestore = this.users().find(u => u.id === userId)?.quranPage ?? 0;
      if (fromFirestore === written) {
        this.writtenQuranPage.set(null);
      }
    }, { allowSignalWrites: true });
  }

  setFilter(habitId: HabitId | null): void {
    this.hapticService.tap();
    this.filteredHabit.set(habitId);
  }

  cellColor(userId: string, date: string): string {
    const h = this.filteredHabit();
    if (!h) {
      const c = this.getMergedCompletions(userId, date);
      let count = 0;
      if (c.sun) count++;
      if (c.doubleSun) count++;
      if (c.book) count++;
      if (c.three) count++;
      if (c.network) count++;
      return this.legendColors[Math.min(count, 5)];
    }
    const done = !!this.getMergedCompletions(userId, date)[h];
    if (!done) return this.legendColors[0];
    return getHabitConfig(h)?.color ?? this.legendColors[5];
  }

  filteredHabitColor(): string {
    const h = this.filteredHabit();
    if (!h) return this.legendColors[5];
    return getHabitConfig(h)?.color ?? this.legendColors[5];
  }

  iconBgFor(color: string): string {
    return `color-mix(in srgb, ${color} 18%, white)`;
  }

  getCompletedItems(completions: HabitCompletions): CompletionItem[] {
    const result: CompletionItem[] = [];
    for (const habit of HABITS) {
      if (completions[habit.id]) {
        const item: CompletionItem = { icon: habit.icon, color: habit.color };
        if (habit.id === 'book' && (completions.bookPages ?? 0) > 0) {
          item.count = completions.bookPages;
        }
        result.push(item);
      }
    }
    return result;
  }

  async onToggleHabit(habitId: HabitId): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;

    if (habitId === 'book') {
      this.hapticService.tap();
      this.showQuranModal.set(true);
      return;
    }

    const date = this.selectedDate();
    const current = this.selectedDateUserCompletions();
    const wasCompleted = !!current[habitId];
    const nextCompletions: HabitCompletions = { ...current, [habitId]: !wasCompleted };

    this.hapticService.tap();
    this.applyOptimistic(userId, date, nextCompletions);

    if (!wasCompleted) {
      const config = getHabitConfig(habitId);
      this.toastService.show(`${config?.name ?? ''} marqué`, {
        icon: config?.icon,
        iconColor: config?.color,
        action: {
          label: 'Annuler',
          handler: async () => {
            this.hapticService.tap();
            this.applyOptimistic(userId, date, current);
            await this.habitService.toggleHabit(userId, date, habitId, nextCompletions);
          }
        }
      });
    }

    try {
      await this.habitService.toggleHabit(userId, date, habitId, current);
    } catch (err) {
      this.revertOptimistic(userId, date);
      this.hapticService.error();
      throw err;
    }
  }

  async onQuranPageChanged(page: number): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;

    const oldPage = this.currentUserQuranPage();
    const delta = page - oldPage;
    if (delta === 0) return;

    this.writtenQuranPage.set(page);
    this.hapticService.success();

    const date = this.selectedDate();
    const current = this.selectedDateUserCompletions();
    const newBookPages = Math.max(0, (current.bookPages ?? 0) + delta);
    this.applyOptimistic(userId, date, {
      ...current,
      book: newBookPages > 0,
      bookPages: newBookPages,
    });

    await this.habitService.updateQuranPage(userId, page);
    await this.habitService.markBookForToday(userId, date, current, delta);
  }

  async onQuranCycleChanged(cycle: number): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;
    await this.habitService.updateQuranCycle(userId, cycle);
  }

  navigateToPreviousDay(): void {
    this.hapticService.tap();
    const current = new Date(this.selectedDate());
    current.setDate(current.getDate() - 1);
    this.selectedDate.set(this.dateService.formatDate(current));
  }

  navigateToNextDay(): void {
    if (this.canNavigateNext()) {
      this.hapticService.tap();
      const current = new Date(this.selectedDate());
      current.setDate(current.getDate() + 1);
      this.selectedDate.set(this.dateService.formatDate(current));
    }
  }

  resetToToday(): void {
    if (this.selectedDate() !== this.today) this.hapticService.tap();
    this.selectedDate.set(this.today);
  }

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
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.SWIPE_THRESHOLD) {
      if (deltaX < 0 && this.currentScreen() === 0) {
        this.currentScreen.set(1);
      } else if (deltaX > 0 && this.currentScreen() === 1) {
        this.currentScreen.set(0);
      }
    }
  }

  getMergedCompletions(userId: string, date: string): HabitCompletions {
    const fromFirestore = this.habitService.getCompletionsForUserAndDate(this.habits$(), userId, date);
    const key = `${userId}|${date}`;
    const overlay = this.optimisticOverlay()[key];
    return overlay ?? fromFirestore;
  }

  private applyOptimistic(userId: string, date: string, completions: HabitCompletions): void {
    const key = `${userId}|${date}`;
    this.optimisticOverlay.update(current => ({ ...current, [key]: completions }));
  }

  private revertOptimistic(userId: string, date: string): void {
    const key = `${userId}|${date}`;
    this.optimisticOverlay.update(current => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  private completionsEqual(a: HabitCompletions, b: HabitCompletions): boolean {
    return a.sun === b.sun
      && a.doubleSun === b.doubleSun
      && a.book === b.book
      && a.three === b.three
      && a.network === b.network
      && (a.bookPages ?? 0) === (b.bookPages ?? 0);
  }
}
