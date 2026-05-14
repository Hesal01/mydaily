import { Component, input, signal, computed, inject, viewChild, ElementRef, effect } from '@angular/core';
import { HABITS } from '../../../core/constants/habits.constants';
import { HabitDay, HabitId } from '../../../core/models/habit.model';
import { User } from '../../../core/models/user.model';
import { HabitStatsService } from '../../../core/services/habit-stats.service';
import { HapticService } from '../../../core/services/haptic.service';

interface HeatCell {
  date: string;
  count: number;
  bookPages: number;
  empty?: boolean;
}

@Component({
  selector: 'app-stats-year',
  standalone: true,
  template: `
    <div class="wrap">
      <div class="filter-bar"
           (touchstart)="$event.stopPropagation()"
           (touchend)="$event.stopPropagation()"
           (touchmove)="$event.stopPropagation()">
        <button class="fchip" [class.active]="!habitFilter()" (click)="setFilter(null)">Tous</button>
        @for (h of habits; track h.id) {
          <button class="fchip" [class.active]="habitFilter() === h.id" [style.--habit-color]="h.color" (click)="setFilter(h.id)">
            <i class="ph ph-{{ h.icon }} fchip-icon"></i>
            <span class="fchip-label">{{ h.name }}</span>
          </button>
        }
      </div>

      <div class="hero">
        <div class="metric">
          <div class="m-num">{{ totalDone() }}</div>
          <div class="m-lbl">{{ habitFilter() ? activeHabitName() + ' faits' : 'habitudes faites' }}</div>
        </div>
        <div class="metric">
          <div class="m-num">{{ activeDays() }}</div>
          <div class="m-lbl">jours actifs</div>
        </div>
        <div class="metric">
          <div class="m-num">{{ activePct() }}%</div>
          <div class="m-lbl">consistance</div>
        </div>
      </div>

      <div class="since-line">
        @if (firstActivityDate(); as start) {
          Depuis {{ formatStart(start) }} · {{ effectiveDays() }} jour{{ effectiveDays() > 1 ? 's' : '' }}
        } @else {
          Pas encore d'activité
        }
      </div>

      <div class="heatmap-wrap"
           #heatmapWrap
           (touchstart)="$event.stopPropagation()"
           (touchend)="$event.stopPropagation()"
           (touchmove)="$event.stopPropagation()">
        <div class="month-labels"
             [style.grid-template-columns]="'repeat(' + heatmapColumns() + ', 11px)'">
          @for (m of monthLabels(); track $index) {
            <span class="month-lbl" [style.grid-column-start]="m.col">{{ m.label }}</span>
          }
        </div>
        <div class="heatmap"
             [style.grid-template-columns]="'repeat(' + heatmapColumns() + ', 11px)'">
          @for (cell of heatCells(); track $index) {
            @if (cell.empty) {
              <div class="hcell empty"></div>
            } @else {
              <div class="hcell"
                   [style.background]="cellColor(cell.count)"
                   [attr.title]="cell.date + ' · ' + cell.count + ' habits' + (cell.bookPages > 0 ? ' · ' + cell.bookPages + 'p' : '')">
              </div>
            }
          }
        </div>
        <div class="legend">
          <span>Less</span>
          @for (level of legendLevels; track level) {
            <span class="hcell mini" [style.background]="cellColor(level)"></span>
          }
          <span>More</span>
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

    .filter-bar {
      display: flex;
      gap: 6px;
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

    .hero {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      background: var(--color-bg);
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
    }
    .metric {
      text-align: center;
    }
    .m-num {
      font-size: 24px;
      font-weight: 800;
      color: var(--color-success-darker);
      line-height: 1;
    }
    .m-lbl {
      font-size: 10px;
      color: var(--color-text-muted);
      font-weight: 600;
      margin-top: 4px;
    }

    .heatmap-wrap {
      background: var(--color-bg);
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      overflow-x: auto;
      touch-action: pan-x;
      scrollbar-width: thin;
    }
    .since-line {
      font-size: 11px;
      color: var(--color-text-muted);
      text-align: center;
      font-weight: 600;
      margin-top: -4px;
    }
    .month-labels {
      display: grid;
      gap: 2px;
      font-size: 9px;
      color: var(--color-text-muted);
      margin-bottom: 4px;
      height: 12px;
    }
    .month-lbl {
      grid-row: 1;
      white-space: nowrap;
    }
    .heatmap {
      display: grid;
      grid-template-rows: repeat(7, 11px);
      grid-auto-flow: column;
      gap: 2px;
    }
    .hcell {
      width: 11px;
      height: 11px;
      border-radius: 2px;
      background: #ebedf0;
    }
    .hcell.empty {
      background: transparent;
    }
    .hcell.mini {
      width: 10px;
      height: 10px;
    }
    .legend {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
      font-size: 10px;
      color: var(--color-text-muted);
      justify-content: flex-end;
    }
  `]
})
export class StatsYearComponent {
  private stats = inject(HabitStatsService);
  private haptic = inject(HapticService);

  readonly habits$ = input.required<HabitDay[]>();
  readonly currentUser = input.required<User | null>();

  readonly habits = HABITS;
  readonly habitFilter = signal<HabitId | null>(null);
  readonly legendLevels = [0, 1, 2, 3, 4, 5];

  readonly activeHabitName = computed(() => {
    const f = this.habitFilter();
    if (!f) return '';
    return HABITS.find(h => h.id === f)?.name ?? '';
  });

  readonly firstActivityDate = computed<string | null>(() => {
    const u = this.currentUser();
    if (!u) return null;
    const userHabits = this.habits$().filter(h => h.userId === u.id);
    if (userHabits.length === 0) return null;
    return userHabits.reduce((min, h) => h.date < min ? h.date : min, userHabits[0].date);
  });

  readonly effectiveDays = computed(() => {
    const start = this.firstActivityDate();
    if (!start) return 0;
    const startDate = new Date(start);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1;
  });

  readonly heatData = computed(() => {
    const u = this.currentUser();
    if (!u) return [];
    const days = Math.min(this.effectiveDays(), 371);
    if (days <= 0) return [];
    const f = this.habitFilter();
    return f
      ? this.stats.getYearHeatmapForHabit(this.habits$(), u.id, f, days)
      : this.stats.getYearHeatmap(this.habits$(), u.id, days);
  });

  readonly heatmapColumns = computed(() => {
    const cells = this.heatCells().length;
    return Math.max(1, Math.ceil(cells / 7));
  });

  formatStart(date: string): string {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  readonly heatCells = computed<HeatCell[]>(() => {
    const data = this.heatData();
    if (data.length === 0) return [];
    // Pad start so first cell aligns to its day-of-week (Monday=0..Sunday=6)
    const first = new Date(data[0].date);
    const jsDay = first.getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
    const padding: HeatCell[] = Array.from({ length: dayOfWeek }, () => ({ date: '', count: 0, bookPages: 0, empty: true }));
    return [...padding, ...data];
  });

  readonly totalDone = computed(() => {
    const data = this.heatData();
    return data.reduce((s, d) => s + d.count, 0);
  });

  readonly activeDays = computed(() => {
    const data = this.heatData();
    return data.filter(d => d.count > 0).length;
  });

  readonly activePct = computed(() => {
    const data = this.heatData();
    if (data.length === 0) return 0;
    return Math.round((this.activeDays() / data.length) * 100);
  });

  readonly monthLabels = computed(() => {
    const data = this.heatData();
    if (data.length === 0) return [];
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const labels: { col: number; label: string }[] = [];
    const cells = this.heatCells();
    let lastMonth = -1;
    cells.forEach((c, i) => {
      if (c.empty) return;
      const d = new Date(c.date);
      const m = d.getMonth();
      if (m !== lastMonth) {
        const col = Math.floor(i / 7) + 1;
        labels.push({ col, label: monthNames[m] });
        lastMonth = m;
      }
    });
    return labels;
  });

  readonly heatmapWrap = viewChild<ElementRef<HTMLDivElement>>('heatmapWrap');

  constructor() {
    effect(() => {
      this.heatCells();
      this.habitFilter();
      const el = this.heatmapWrap()?.nativeElement;
      if (!el) return;
      queueMicrotask(() => {
        el.scrollLeft = el.scrollWidth;
      });
    });
  }

  setFilter(h: HabitId | null): void {
    this.haptic.tap();
    this.habitFilter.set(h);
  }

  cellColor(count: number): string {
    const f = this.habitFilter();
    if (count === 0) return '#ebedf0';
    if (f) {
      const c = HABITS.find(h => h.id === f)?.color ?? '#2da44e';
      return c;
    }
    const greens = ['#ebedf0', '#c6e48b', '#7bc96f', '#49af5d', '#2e8b47', '#1e6823'];
    return greens[Math.min(count, 5)];
  }
}
