import { Component, input, signal, computed, inject } from '@angular/core';
import { HABITS } from '../../../core/constants/habits.constants';
import { HabitDay, HabitId } from '../../../core/models/habit.model';
import { User } from '../../../core/models/user.model';
import { HabitStatsService, LeaderRow } from '../../../core/services/habit-stats.service';
import { HapticService } from '../../../core/services/haptic.service';

type Period = 7 | 30 | 365;
type Mode = 'total' | 'pages' | 'quran' | HabitId;

@Component({
  selector: 'app-stats-leaderboard',
  standalone: true,
  template: `
    <div class="wrap">
      <div class="card">
        <div class="period-row">
          <button class="pchip" [class.active]="period() === 7" (click)="setPeriod(7)">7j</button>
          <button class="pchip" [class.active]="period() === 30" (click)="setPeriod(30)">30j</button>
          <button class="pchip" [class.active]="period() === 365" (click)="setPeriod(365)">1 an</button>
        </div>
        <div class="mode-row"
             (touchstart)="$event.stopPropagation()"
             (touchend)="$event.stopPropagation()"
             (touchmove)="$event.stopPropagation()">
          <button class="mchip" [class.active]="mode() === 'total'" (click)="setMode('total')">
            <span>Habits</span>
          </button>
          <button class="mchip" [class.active]="mode() === 'pages'" (click)="setMode('pages')" [style.--habit-color]="bookColor">
            <i class="ph ph-book-open"></i><span>Pages</span>
          </button>
          <button class="mchip" [class.active]="mode() === 'quran'" (click)="setMode('quran')" [style.--habit-color]="bookColor">
            <span>Coran ∑</span>
          </button>
          @for (h of habits; track h.id) {
            <button class="mchip" [class.active]="mode() === h.id" [style.--habit-color]="h.color" (click)="setMode(h.id)">
              <i class="ph ph-{{ h.icon }}"></i>
            </button>
          }
        </div>
      </div>

      <div class="card">
        <div class="leader-title">{{ modeTitle() }}</div>
        <div class="rows">
          @for (row of rows(); track row.userId; let i = $index) {
            <div class="lrow" [class.mine]="row.userId === currentUserId()" [class.podium]="i < 3 && row.value > 0">
              <div class="rank">
                @if (i === 0 && row.value > 0) {
                  <span class="medal">🥇</span>
                } @else if (i === 1 && row.value > 0) {
                  <span class="medal">🥈</span>
                } @else if (i === 2 && row.value > 0) {
                  <span class="medal">🥉</span>
                } @else {
                  <span class="rank-n">{{ i + 1 }}</span>
                }
              </div>
              <div class="animal">{{ animalFor(row.userId) }}</div>
              <div class="bar-wrap">
                <div class="bar-fill" [style.width.%]="row.value > 0 ? (row.value / maxValue()) * 100 : 0"
                     [style.background]="barColor()"></div>
              </div>
              <div class="value">{{ formatValue(row.value) }}</div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wrap {
      padding: 12px 16px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card {
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 14px;
      box-shadow: var(--shadow-card);
    }

    .period-row {
      display: flex;
      gap: 6px;
      justify-content: center;
      margin-bottom: 10px;
    }
    .pchip {
      padding: 5px 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--color-border);
      background: var(--color-bg);
      color: var(--color-text-muted);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      touch-action: manipulation;
      transition: all var(--duration-fast) var(--spring);
    }
    .pchip.active {
      background: var(--color-text);
      color: #fff;
      border-color: var(--color-text);
    }

    .mode-row {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      touch-action: pan-x;
    }
    .mode-row::-webkit-scrollbar { display: none; }
    .mchip {
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
      transition: all var(--duration-fast) var(--spring);
    }
    .mchip:active { transform: scale(0.94); }
    .mchip.active {
      background: var(--habit-color, var(--color-text));
      color: #fff;
      border-color: var(--habit-color, var(--color-text));
    }
    .mchip i { font-size: 13px; line-height: 1; }

    .leader-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 10px;
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .lrow {
      display: grid;
      grid-template-columns: 28px 24px 1fr 50px;
      align-items: center;
      gap: 8px;
      padding: 6px 4px;
      border-radius: var(--radius-sm);
      transition: background var(--duration-base) ease;
    }
    .lrow.mine {
      background: var(--color-success-soft);
    }
    .lrow.podium .value {
      font-weight: 800;
    }
    .rank {
      text-align: center;
      font-size: 14px;
    }
    .rank-n {
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 700;
    }
    .medal {
      font-size: 16px;
    }
    .animal {
      font-size: 20px;
      text-align: center;
    }
    .bar-wrap {
      height: 12px;
      background: var(--color-surface-2);
      border-radius: var(--radius-pill);
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      background: var(--color-success);
      border-radius: var(--radius-pill);
      transition: width var(--duration-slow) var(--ease-out);
    }
    .value {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-text);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `]
})
export class StatsLeaderboardComponent {
  private stats = inject(HabitStatsService);
  private haptic = inject(HapticService);

  readonly habits$ = input.required<HabitDay[]>();
  readonly users = input.required<User[]>();
  readonly animalsByUserId = input.required<Record<string, string>>();
  readonly currentUserId = input.required<string | null>();

  readonly habits = HABITS;
  readonly bookColor = '#3b82f6';

  readonly period = signal<Period>(30);
  readonly mode = signal<Mode>('total');

  readonly rows = computed<LeaderRow[]>(() => {
    const m = this.mode();
    const days = this.period();
    if (m === 'total') return this.stats.getTotalHabitsLeaderboard(this.habits$(), this.users(), days);
    if (m === 'pages') return this.stats.getPagesLeaderboard(this.habits$(), this.users(), days);
    if (m === 'quran') return this.stats.getQuranLeaderboard(this.users());
    return this.stats.getHabitLeaderboard(this.habits$(), this.users(), m, days);
  });

  readonly maxValue = computed(() => {
    const r = this.rows();
    return Math.max(1, ...r.map(row => row.value));
  });

  readonly modeTitle = computed(() => {
    const m = this.mode();
    const periodLabel = this.period() === 365 ? '1 an' : `${this.period()}j`;
    if (m === 'total') return `Habits totaux · ${periodLabel}`;
    if (m === 'pages') return `Pages lues · ${periodLabel}`;
    if (m === 'quran') return `Progression Coran (cumul)`;
    const h = HABITS.find(x => x.id === m);
    return `${h?.name ?? m} · ${periodLabel}`;
  });

  setPeriod(p: Period): void {
    this.haptic.tap();
    this.period.set(p);
  }

  setMode(m: Mode): void {
    this.haptic.tap();
    this.mode.set(m);
  }

  animalFor(userId: string): string {
    return this.animalsByUserId()[userId] ?? '?';
  }

  barColor(): string {
    const m = this.mode();
    if (m === 'pages' || m === 'quran') return this.bookColor;
    if (m === 'total') return '#2da44e';
    const h = HABITS.find(x => x.id === m);
    return h?.color ?? '#2da44e';
  }

  formatValue(value: number): string {
    return value.toString();
  }
}
