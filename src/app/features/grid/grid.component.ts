import { Component, inject, computed, effect, signal, OnDestroy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HabitButtonsComponent } from './components/habit-buttons.component';
import { QuranModalComponent } from './components/quran-modal.component';
import { QuranProgressComponent } from './components/quran-progress.component';
import { StudyModalComponent } from './components/study-modal.component';
import { StudyProgressComponent } from './components/study-progress.component';
import { InstallPromptComponent } from '../../shared/components/install-prompt.component';
import { ToastComponent } from '../../shared/components/toast.component';
import { StatsPersonalComponent } from './components/stats-personal.component';
import { StatsYearComponent } from './components/stats-year.component';
import { StatsLeaderboardComponent } from './components/stats-leaderboard.component';
import { SettingsComponent } from './components/settings.component';
import { AuthService } from '../../core/services/auth.service';
import { HabitService } from '../../core/services/habit.service';
import { DateService } from '../../core/services/date.service';
import { NotificationService } from '../../core/services/notification.service';
import { HapticService } from '../../core/services/haptic.service';
import { ToastService } from '../../core/services/toast.service';
import { CamelWatcherService } from '../../core/services/camel-watcher.service';
import { CongratsService } from '../../core/services/congrats.service';
import { HabitId, HabitCompletions, createEmptyCompletions } from '../../core/models/habit.model';
import { Congrats } from '../../core/models/congrats.model';
import { HABITS, USER_ICONS, getHabitConfig } from '../../core/constants/habits.constants';
import { getSurah } from '../../core/constants/surahs.constants';
import { CelebrationOverlayComponent, CelebrationBurst, CelebrationParticle } from './components/celebration-overlay.component';

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
    StudyModalComponent,
    StudyProgressComponent,
    InstallPromptComponent,
    ToastComponent,
    StatsPersonalComponent,
    StatsYearComponent,
    StatsLeaderboardComponent,
    SettingsComponent,
    CelebrationOverlayComponent,
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
                  <div class="animal-header" [style.grid-template-columns]="'repeat(' + visibleUsers().length + ', 1fr)'">
                    @for (user of visibleUsers(); track user.id) {
                      <div class="animal" [class.mine]="user.id === currentUserId()">
                        {{ animalsByUserId()[user.id] || '?' }}
                      </div>
                    }
                  </div>

                  <!-- Grid -->
                  <div class="grid" [style.grid-template-columns]="'repeat(' + visibleUsers().length + ', 1fr)'">
                    @for (date of dates(); track date) {
                      @for (user of visibleUsers(); track user.id) {
                        <div
                          class="cell"
                          [attr.data-cell]="user.id + '_' + date"
                          [class.mine]="user.id === currentUserId()"
                          [class.today]="date === today"
                          [class.selected]="date === selectedDate()"
                          [class.congratulable]="canCongratulate(user.id, date)"
                          [class.pressing]="isPressingCell(user.id, date)"
                          [style.background-color]="cellColor(user.id, date)"
                          (pointerdown)="onCellPointerDown($event, user.id, date)"
                          (pointermove)="onCellPointerMove($event)"
                          (pointerup)="onCellPointerUp()"
                          (pointercancel)="onCellPointerUp()"
                          (contextmenu)="$event.preventDefault()"
                        >
                          @if (date === today && congratsCounts()[user.id]) {
                            <span class="cell-badge">{{ congratsCounts()[user.id] }}</span>
                          }
                        </div>
                      }
                    }
                  </div>

                  <div class="legend">
                    @if (filteredHabit() === 'book') {
                      <span>0p</span>
                      @for (color of bookLegendShades(); track color) {
                        <span class="legend-box" [style.background-color]="color"></span>
                      }
                      <span>30p+</span>
                    } @else if (filteredHabit()) {
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

                  <div class="icon-matrix" [style.grid-template-columns]="'repeat(' + visibleUsers().length + ', 1fr)'">
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
                  [users]="visibleUsers()"
                  [animalsByUserId]="animalsByUserId()"
                  [currentUserId]="currentUserId()"
                />
                <app-study-progress
                  [users]="visibleUsers()"
                  [animalsByUserId]="animalsByUserId()"
                  [currentUserId]="currentUserId()"
                />
              </div>
            </div>

            <!-- Screen 2: Personal stats -->
            <div class="screen">
              <app-stats-personal
                [habits]="habits$()"
                [currentUser]="currentUserObj()"
              />
            </div>

            <!-- Screen 3: Year heatmap -->
            <div class="screen">
              <app-stats-year
                [habits$]="habits$()"
                [currentUser]="currentUserObj()"
              />
            </div>

            <!-- Screen 4: Leaderboard -->
            <div class="screen">
              <app-stats-leaderboard
                [habits$]="habits$()"
                [users]="visibleUsers()"
                [animalsByUserId]="animalsByUserId()"
                [currentUserId]="currentUserId()"
              />
            </div>

            <!-- Screen 5: Settings -->
            <div class="screen">
              <app-settings
                [currentUser]="currentUserObj()"
                [visibleUsersCount]="visibleUsers().length"
                [totalUsersCount]="users().length"
              />
            </div>
          </div>
        </div>

        <div class="screen-dots">
          @for (i of screenIndices; track i) {
            <button class="dot" [class.active]="currentScreen() === i" (click)="setScreen(i)" [attr.aria-label]="screenLabels[i]"></button>
          }
        </div>

        @if (currentScreen() === 0) {
          <div class="control-zone">
            <app-habit-buttons
              [completions]="selectedDateUserCompletions()"
              [canEdit]="canEdit()"
              [infoDate]="selectedDateShort()"
              (toggleHabit)="onToggleHabit($event)"
            />
          </div>
        }
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

      @if (showStudyModal()) {
        <app-study-modal
          [currentUser]="currentUserObj()"
          [allUsers]="users()"
          [animalsByUserId]="animalsByUserId()"
          [currentUserId]="currentUserId()"
          [studyDoneToday]="selectedDateUserCompletions().study"
          (selectSurah)="onStudySelectSurah($event)"
          (markVerse)="onStudyMarkVerse($event)"
          (completeSurah)="onStudyComplete($event)"
          (unmarkToday)="onStudyUnmark()"
          (close)="showStudyModal.set(false)"
        />
      }

      <app-celebration-overlay [bursts]="celebrations()" [toast]="congratsMessage()" />
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
      position: relative;
      transition: background-color var(--duration-base) ease, transform 0.15s ease;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    .cell.mine { filter: brightness(0.92); }
    .cell.selected { box-shadow: inset 0 0 0 1.5px rgba(0, 0, 0, 0.4); }
    .cell.today { outline: 1px solid var(--color-success-darker); outline-offset: -1px; }
    .cell.congratulable {
      cursor: pointer;
      /* Claim the touch so iOS Safari doesn't hijack the long-press. */
      touch-action: none;
    }
    .cell.pressing {
      transform: scale(1.35);
      z-index: 5;
      animation: cell-charging 0.5s ease-out forwards;
    }
    @keyframes cell-charging {
      0% { box-shadow: 0 0 0 0 rgba(245, 183, 0, 0.7); }
      100% { box-shadow: 0 0 0 7px rgba(245, 183, 0, 0), 0 0 14px 4px rgba(245, 183, 0, 0.95); }
    }
    .cell-badge {
      position: absolute;
      top: 1px;
      right: 1px;
      min-width: 11px;
      height: 11px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 2px;
      font-size: 8px;
      font-weight: 800;
      line-height: 1;
      color: #ffffff;
      background: #f5b700;
      border-radius: 999px;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
      pointer-events: none;
      z-index: 3;
    }

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
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: var(--color-bg);
      width: 100%;
      min-width: 0;
    }
    .mtx-cell {
      min-height: 30px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      padding: 3px 1px;
      overflow: hidden;
      transition: background var(--duration-base) ease;
    }
    .mtx-cell.col-last { border-right: none; }
    .mtx-cell.row-last { border-bottom: none; }
    .mtx-cell.mine:not(.done) { background: color-mix(in srgb, var(--color-success) 6%, transparent); }
    .mtx-cell.done { background: color-mix(in srgb, var(--habit-color) 20%, white); }
    .mtx-cell.done.mine { background: color-mix(in srgb, var(--habit-color) 32%, white); }
    .mtx-ic {
      font-size: 16px;
      line-height: 1;
      color: color-mix(in srgb, var(--habit-color) 78%, black);
      flex-shrink: 0;
    }
    .mtx-count {
      font-size: 9px;
      font-weight: 700;
      color: color-mix(in srgb, var(--habit-color) 75%, black);
      line-height: 1;
    }

    @media (max-width: 360px) {
      .mtx-ic { font-size: 13px; }
      .mtx-count { font-size: 8px; }
      .mtx-cell { min-height: 26px; padding: 2px 1px; }
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
export class GridComponent implements OnDestroy {
  private authService = inject(AuthService);
  private habitService = inject(HabitService);
  private dateService = inject(DateService);
  private notificationService = inject(NotificationService);
  private hapticService = inject(HapticService);
  private toastService = inject(ToastService);
  private camelWatcher = inject(CamelWatcherService);
  private congratsService = inject(CongratsService);

  readonly currentUserId = this.authService.userId;
  readonly today = this.dateService.getToday();
  readonly habits = HABITS;
  readonly filteredHabit = signal<HabitId | null>(null);

  readonly currentScreen = signal(0);
  readonly screenIndices = [0, 1, 2, 3, 4, 5];
  readonly screenLabels = ['Habitudes', 'Coran', 'Aperçu', 'Année', 'Classement', 'Paramètres'];
  readonly showQuranModal = signal(false);
  readonly showStudyModal = signal(false);

  readonly currentUserObj = computed(() => {
    const id = this.currentUserId();
    if (!id) return null;
    return this.users().find(u => u.id === id) ?? null;
  });
  readonly selectedDate = signal<string>(this.today);
  readonly dates = computed(() => this.dateService.getWeekForDate(this.selectedDate()));

  readonly users = toSignal(this.habitService.getAllUsers(), { initialValue: [] });
  readonly habits$ = toSignal(this.habitService.getAllHabitsRealtime(), { initialValue: [] });
  readonly todayCongrats = toSignal(this.congratsService.getCongratsForDate(this.today), { initialValue: [] as Congrats[] });

  readonly visibleUsers = computed(() => {
    const all = this.users();
    const meId = this.currentUserId();
    const me = all.find(u => u.id === meId);
    if (me?.privacyMode) return [me];
    return all.filter(u => u.id === meId || !u.privacyMode);
  });

  readonly animalsByUserId = computed(() => {
    const map: Record<string, string> = {};
    this.users().forEach((u, i) => {
      map[u.id] = USER_ICONS[i] ?? '?';
    });
    return map;
  });

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
    return this.visibleUsers().map(user => ({
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
    this.camelWatcher.start();

    effect(() => {
      const userId = this.currentUserId();
      if (userId) {
        this.notificationService.requestPermissionAndSaveToken(userId);
        this.notificationService.listenForMessages();
      }
    }, { allowSignalWrites: true });

    // Celebrate incoming congratulations live (and replay missed ones on open).
    // Tracking the clap `count` (not just the doc id) lets every re-send/spam
    // re-fire the animation, while the badge — counting docs — stays put.
    effect(() => {
      const me = this.currentUserId();
      const list = this.todayCongrats();
      if (!me) return;
      let queued = 0;
      for (const c of list) {
        if (c.to !== me) continue;
        const current = c.count ?? 1;
        // First time seen this session: an already-seen doc starts at its full
        // count (no replay); an unseen one starts at 0 (replay what was missed).
        const baseline = this.animatedCongrats.has(c.id)
          ? this.animatedCongrats.get(c.id)!
          : (c.seen ? current : 0);
        if (current <= baseline) continue;
        this.animatedCongrats.set(c.id, current);
        const slot = queued++;
        setTimeout(() => {
          this.celebrateForReceiver(c);
          if (!c.seen) this.congratsService.markSeen(c.id);
        }, slot * 450);
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

  ngOnDestroy(): void {
    this.camelWatcher.stop();
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
      for (const habit of this.habits) {
        if (c[habit.id]) count++;
      }
      return this.legendColors[Math.min(count, this.legendColors.length - 1)];
    }
    if (h === 'book') {
      const pages = this.getMergedCompletions(userId, date).bookPages ?? 0;
      return this.bookIntensityColor(pages);
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

  bookIntensityColor(pages: number): string {
    const book = getHabitConfig('book')?.color ?? '#3b82f6';
    if (pages === 0) return this.legendColors[0];
    if (pages <= 2) return `color-mix(in srgb, ${book} 25%, white)`;
    if (pages <= 6) return `color-mix(in srgb, ${book} 45%, white)`;
    if (pages <= 14) return `color-mix(in srgb, ${book} 65%, white)`;
    if (pages <= 29) return `color-mix(in srgb, ${book} 85%, white)`;
    return book;
  }

  readonly bookLegendShades = computed(() => {
    const book = getHabitConfig('book')?.color ?? '#3b82f6';
    return [
      this.legendColors[0],
      `color-mix(in srgb, ${book} 25%, white)`,
      `color-mix(in srgb, ${book} 45%, white)`,
      `color-mix(in srgb, ${book} 65%, white)`,
      `color-mix(in srgb, ${book} 85%, white)`,
      book,
    ];
  });

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

    if (habitId === 'study') {
      this.hapticService.tap();
      this.showStudyModal.set(true);
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

  // ===== Étude des sourates =====

  async onStudySelectSurah(surahNumber: number): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;
    this.hapticService.tap();
    const u = this.currentUserObj();
    const resumeVerse = u?.studyProgress?.[String(surahNumber)] ?? 0;
    await this.habitService.updateStudySurah(
      userId,
      surahNumber,
      resumeVerse,
      u?.studySurah,
      u?.studyVerse ?? 0
    );
  }

  async onStudyMarkVerse(event: { surah: number; verse: number }): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;

    const date = this.selectedDate();
    const current = this.getMergedCompletions(userId, date);
    if (current.study) {
      // Already done today — just update the verse silently.
      await this.habitService.markStudyForToday(userId, date, current, event.verse, event.surah);
      this.hapticService.success();
      return;
    }

    this.hapticService.success();
    this.applyOptimistic(userId, date, { ...current, study: true });

    this.toastService.show('Étude marquée', {
      icon: 'book-open-text',
      iconColor: getHabitConfig('study')?.color,
      action: {
        label: 'Annuler',
        handler: async () => {
          this.hapticService.tap();
          this.applyOptimistic(userId, date, { ...current, study: false });
          await this.habitService.unmarkStudyForToday(userId, date, { ...current, study: true });
        }
      }
    });

    try {
      await this.habitService.markStudyForToday(userId, date, current, event.verse, event.surah);
    } catch (err) {
      this.revertOptimistic(userId, date);
      this.hapticService.error();
      throw err;
    }
  }

  async onStudyComplete(event: { surah: number; verse: number }): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;

    const date = this.selectedDate();
    const current = this.getMergedCompletions(userId, date);

    this.hapticService.success();
    this.applyOptimistic(userId, date, { ...current, study: true });
    this.spawnBurstAtViewportCenter();
    const name = getSurah(event.surah)?.nameFr ?? '';
    this.showCongratsMessage(`Sourate ${name} terminée ! 🎉`);

    try {
      await this.habitService.markStudyForToday(userId, date, current, event.verse, event.surah);
      await this.habitService.completeStudySurah(userId, event.surah, event.verse);
    } catch (err) {
      this.revertOptimistic(userId, date);
      this.hapticService.error();
      throw err;
    }
  }

  async onStudyUnmark(): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) return;

    const date = this.selectedDate();
    const current = this.getMergedCompletions(userId, date);
    this.hapticService.tap();
    this.applyOptimistic(userId, date, { ...current, study: false });
    await this.habitService.unmarkStudyForToday(userId, date, current);
  }

  private spawnBurstAtViewportCenter(): void {
    const id = ++this.burstSeq;
    this.celebrations.update(list => [...list, {
      id,
      x: window.innerWidth / 2,
      y: window.innerHeight / 3,
      particles: this.makeParticles()
    }]);
    setTimeout(() => {
      this.celebrations.update(list => list.filter(b => b.id !== id));
    }, 1100);
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
      const current = this.currentScreen();
      if (deltaX < 0 && current < this.screenIndices.length - 1) {
        this.setScreen(current + 1);
      } else if (deltaX > 0 && current > 0) {
        this.setScreen(current - 1);
      }
    }
  }

  setScreen(i: number): void {
    if (this.currentScreen() === i) return;
    this.hapticService.tap();
    this.currentScreen.set(i);
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
      && a.study === b.study
      && (a.bookPages ?? 0) === (b.bookPages ?? 0);
  }

  // ===== Congratulations: long-press gesture + celebration =====

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressTarget: { userId: string; date: string } | null = null;
  private pressStartX = 0;
  private pressStartY = 0;
  private burstSeq = 0;
  // docId -> highest clap count already animated this session.
  private readonly animatedCongrats = new Map<string, number>();
  private readonly LONG_PRESS_MS = 500;
  private readonly MOVE_CANCEL_PX = 12;

  readonly pressingCell = signal<{ userId: string; date: string } | null>(null);
  readonly celebrations = signal<CelebrationBurst[]>([]);
  readonly congratsMessage = signal<string | null>(null);
  private congratsMsgTimer: ReturnType<typeof setTimeout> | null = null;

  // Congratulations received per user today (drives the badges).
  readonly congratsCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const c of this.todayCongrats()) {
      counts[c.to] = (counts[c.to] || 0) + 1;
    }
    return counts;
  });

  private hasAnyCompletion(userId: string, date: string): boolean {
    const c = this.getMergedCompletions(userId, date);
    return this.habits.some(habit => !!c[habit.id]);
  }

  // Only today's cells, belonging to someone else, with at least one habit done.
  canCongratulate(userId: string, date: string): boolean {
    if (date !== this.today) return false;
    if (userId === this.currentUserId()) return false;
    return this.hasAnyCompletion(userId, date);
  }

  isPressingCell(userId: string, date: string): boolean {
    const p = this.pressingCell();
    return p !== null && p.userId === userId && p.date === date;
  }

  onCellPointerDown(event: PointerEvent, userId: string, date: string): void {
    if (!this.canCongratulate(userId, date)) return;
    this.pressStartX = event.clientX;
    this.pressStartY = event.clientY;
    this.longPressTarget = { userId, date };
    this.pressingCell.set({ userId, date });
    this.hapticService.tap();
    this.longPressTimer = setTimeout(() => this.completeLongPress(), this.LONG_PRESS_MS);
  }

  onCellPointerMove(event: PointerEvent): void {
    if (!this.longPressTimer) return;
    const dx = Math.abs(event.clientX - this.pressStartX);
    const dy = Math.abs(event.clientY - this.pressStartY);
    if (dx > this.MOVE_CANCEL_PX || dy > this.MOVE_CANCEL_PX) {
      this.cancelLongPress();
    }
  }

  onCellPointerUp(): void {
    this.cancelLongPress();
  }

  private cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressTarget = null;
    this.pressingCell.set(null);
  }

  private async completeLongPress(): Promise<void> {
    this.longPressTimer = null;
    const target = this.longPressTarget;
    this.longPressTarget = null;
    this.pressingCell.set(null);
    if (!target) return;

    const from = this.currentUserId();
    if (!from) return;

    this.hapticService.success();
    this.spawnBurstAtCell(target.userId, target.date);
    this.showCongratsMessage(`Bravo envoyé à ${this.animalFor(target.userId)} ! 👏`);

    try {
      await this.congratsService.sendCongrats(from, target.userId, target.date);
    } catch (error) {
      console.error('Failed to send congrats:', error);
    }
  }

  private celebrateForReceiver(c: Congrats): void {
    this.hapticService.success();
    this.spawnBurstAtCell(c.to, c.date);
    this.showCongratsMessage(`${this.animalFor(c.from)} t'a félicité ! 👏`);
  }

  private spawnBurstAtCell(userId: string, date: string): void {
    const center = this.cellCenter(userId, date) ?? {
      x: window.innerWidth / 2,
      y: window.innerHeight / 3
    };
    const id = ++this.burstSeq;
    this.celebrations.update(list => [...list, { id, x: center.x, y: center.y, particles: this.makeParticles() }]);
    setTimeout(() => {
      this.celebrations.update(list => list.filter(b => b.id !== id));
    }, 1100);
  }

  private cellCenter(userId: string, date: string): { x: number; y: number } | null {
    if (typeof document === 'undefined') return null;
    const el = document.querySelector(`[data-cell="${userId}_${date}"]`) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    // Off-screen (other swipe screen / non-visible week) -> caller falls back to centre.
    if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) return null;
    return { x, y };
  }

  private makeParticles(): CelebrationParticle[] {
    const colors = ['#f5b700', '#ff5470', '#2da44e', '#3b82f6', '#a855f7', '#ffd60a'];
    const emojis = ['✨', '🎉', '👏'];
    const particles: CelebrationParticle[] = [];
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const dist = 55 + Math.random() * 75;
      const isEmoji = i % 5 === 0;
      particles.push({
        tx: `${Math.round(Math.cos(angle) * dist)}px`,
        ty: `${Math.round(Math.sin(angle) * dist - 25)}px`,
        rot: `${Math.round((Math.random() - 0.5) * 720)}deg`,
        color: colors[i % colors.length],
        isEmoji,
        char: emojis[i % emojis.length],
        delay: Math.round(Math.random() * 90)
      });
    }
    return particles;
  }

  private animalFor(userId: string): string {
    return this.animalsByUserId()[userId] || '🐾';
  }

  private showCongratsMessage(text: string): void {
    this.congratsMessage.set(text);
    if (this.congratsMsgTimer) clearTimeout(this.congratsMsgTimer);
    // Stays ~4s (CSS fades out at 3.9s); clear after the fade completes.
    this.congratsMsgTimer = setTimeout(() => this.congratsMessage.set(null), 4400);
  }
}
