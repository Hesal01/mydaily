import { Component, input, computed } from '@angular/core';
import { HABITS } from '../../../core/constants/habits.constants';
import { HabitDay, HabitId } from '../../../core/models/habit.model';
import { User } from '../../../core/models/user.model';
import { HabitStatsService } from '../../../core/services/habit-stats.service';
import { inject } from '@angular/core';

interface BarItem {
  label: string;
  icon: string;
  color: string;
  count: number;
  max: number;
}

@Component({
  selector: 'app-stats-personal',
  standalone: true,
  template: `
    <div class="wrap">
      <div class="hero card">
        <div class="hero-fire">🔥</div>
        <div class="hero-num">{{ currentStreak() }}</div>
        <div class="hero-lbl">jour{{ currentStreak() > 1 ? 's' : '' }} d'affilée</div>
        <div class="hero-sub">record : {{ longestStreak() }}j</div>
      </div>

      <div class="card">
        <div class="card-title">Progression Coran</div>
        <div class="donut-row">
          <div class="donut" [style.background]="donutStyle()">
            <div class="donut-hole">
              <div class="donut-num">{{ quranPct() }}%</div>
              <div class="donut-lbl">p.{{ quranPage() }}/604</div>
            </div>
          </div>
          <div class="donut-side">
            <div class="cycle-row">Cycle {{ quranCycle() + 1 }}</div>
            <div class="cycle-dots">
              @for (i of cycleDots(); track i) {
                <span class="cdot"></span>
              }
            </div>
            <div class="pages-left">{{ 604 - quranPage() }} pages restantes</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Streak par habitude</div>
        <div class="streak-grid">
          @for (s of perHabitStreaks(); track s.id) {
            <div class="streak-chip" [style.--habit-color]="s.color" [class.zero]="s.current === 0">
              <i class="ph ph-{{ s.icon }} sc-icon"></i>
              <div class="sc-num">
                <span class="sc-fire">🔥</span>{{ s.current }}
              </div>
              <div class="sc-label">{{ s.name }}</div>
            </div>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-title">7 derniers jours</div>
        <div class="bars">
          @for (b of weeklyBars(); track b.label) {
            <div class="bar-row" [style.--habit-color]="b.color">
              <i class="ph ph-{{ b.icon }} br-icon"></i>
              <div class="br-track">
                <div class="br-fill" [style.width.%]="(b.count / b.max) * 100"></div>
              </div>
              <div class="br-num">{{ b.count }}/{{ b.max }}</div>
            </div>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-title">Pages lues — 30 derniers jours</div>
        <div class="spark-info">
          <span class="spark-big">{{ totalPages() }}</span>
          <span class="spark-lbl">pages · moy {{ avgPages() }}p/j</span>
        </div>
        <svg class="spark-svg" [attr.viewBox]="'0 0 ' + sparkPoints().length * 10 + ' 40'" preserveAspectRatio="none">
          <polyline
            [attr.points]="sparkPath()"
            fill="none"
            stroke="#3b82f6"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <polyline
            [attr.points]="sparkPathArea()"
            fill="rgba(59, 130, 246, 0.12)"
            stroke="none"
          />
        </svg>
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
    .card-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 12px;
    }

    .hero {
      text-align: center;
      padding: 20px 14px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--color-success) 12%, white), white);
    }
    .hero-fire {
      font-size: 32px;
      line-height: 1;
    }
    .hero-num {
      font-size: 56px;
      font-weight: 800;
      color: var(--color-success-darker);
      line-height: 1.1;
      letter-spacing: -2px;
    }
    .hero-lbl {
      font-size: 14px;
      color: var(--color-text);
      font-weight: 600;
    }
    .hero-sub {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 6px;
    }

    .streak-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
    }
    .streak-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 10px 4px 8px;
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--habit-color) 10%, white);
      border: 1px solid color-mix(in srgb, var(--habit-color) 35%, white);
    }
    .streak-chip.zero {
      background: var(--color-surface-1);
      border-color: var(--color-border);
      opacity: 0.6;
    }
    .sc-icon {
      font-size: 18px;
      color: color-mix(in srgb, var(--habit-color) 80%, black);
      line-height: 1;
    }
    .sc-num {
      font-size: 16px;
      font-weight: 800;
      color: color-mix(in srgb, var(--habit-color) 78%, black);
      line-height: 1.1;
    }
    .sc-fire {
      font-size: 10px;
      margin-right: 1px;
    }
    .sc-label {
      font-size: 9px;
      color: var(--color-text-muted);
      font-weight: 600;
      text-align: center;
      line-height: 1.1;
    }

    .bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 22px 1fr 36px;
      align-items: center;
      gap: 8px;
    }
    .br-icon {
      font-size: 16px;
      color: var(--habit-color);
    }
    .br-track {
      height: 10px;
      background: var(--color-surface-2);
      border-radius: var(--radius-pill);
      overflow: hidden;
    }
    .br-fill {
      height: 100%;
      background: var(--habit-color);
      border-radius: var(--radius-pill);
      transition: width var(--duration-slow) var(--ease-out);
    }
    .br-num {
      font-size: 11px;
      font-weight: 700;
      color: var(--color-text-muted);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .spark-info {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 8px;
    }
    .spark-big {
      font-size: 28px;
      font-weight: 800;
      color: #3b82f6;
      line-height: 1;
    }
    .spark-lbl {
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .spark-svg {
      width: 100%;
      height: 50px;
      display: block;
    }

    .donut-row {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .donut {
      width: 110px;
      height: 110px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .donut-hole {
      width: 76px;
      height: 76px;
      background: var(--color-bg);
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .donut-num {
      font-size: 22px;
      font-weight: 800;
      color: var(--color-text);
      line-height: 1;
    }
    .donut-lbl {
      font-size: 10px;
      color: var(--color-text-muted);
      font-weight: 600;
      margin-top: 2px;
    }
    .donut-side {
      flex: 1;
      min-width: 0;
    }
    .cycle-row {
      font-size: 14px;
      font-weight: 700;
      color: var(--color-text);
    }
    .cycle-dots {
      display: flex;
      gap: 4px;
      margin: 6px 0;
    }
    .cdot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-success);
    }
    .pages-left {
      font-size: 12px;
      color: var(--color-text-muted);
    }
  `]
})
export class StatsPersonalComponent {
  private stats = inject(HabitStatsService);

  readonly habits = input.required<HabitDay[]>();
  readonly currentUser = input.required<User | null>();

  readonly habitsList = HABITS;

  readonly currentStreak = computed(() => {
    const u = this.currentUser();
    if (!u) return 0;
    return this.stats.getCurrentStreak(this.habits(), u.id, 'any');
  });

  readonly longestStreak = computed(() => {
    const u = this.currentUser();
    if (!u) return 0;
    return this.stats.getLongestStreak(this.habits(), u.id, 'any');
  });

  readonly perHabitStreaks = computed(() => {
    const u = this.currentUser();
    if (!u) return HABITS.map(h => ({ id: h.id, icon: h.icon, color: h.color, name: h.name, current: 0 }));
    return HABITS.map(h => ({
      id: h.id,
      icon: h.icon,
      color: h.color,
      name: h.name,
      current: this.stats.getCurrentStreak(this.habits(), u.id, h.id),
    }));
  });

  readonly weeklyBars = computed<BarItem[]>(() => {
    const u = this.currentUser();
    if (!u) return [];
    const counts = this.stats.getWeekCompletion(this.habits(), u.id, 7);
    return HABITS.map(h => ({
      label: h.name,
      icon: h.icon,
      color: h.color,
      count: counts[h.id] ?? 0,
      max: 7,
    }));
  });

  readonly sparkPoints = computed(() => {
    const u = this.currentUser();
    if (!u) return [];
    return this.stats.getPagesPerDay(this.habits(), u.id, 30);
  });

  readonly totalPages = computed(() => this.sparkPoints().reduce((s, p) => s + p.pages, 0));
  readonly avgPages = computed(() => {
    const total = this.totalPages();
    return total > 0 ? Math.round(total / 30) : 0;
  });

  readonly sparkPath = computed(() => {
    const points = this.sparkPoints();
    if (points.length === 0) return '';
    const maxPages = Math.max(1, ...points.map(p => p.pages));
    return points
      .map((p, i) => `${i * 10},${40 - (p.pages / maxPages) * 36 - 2}`)
      .join(' ');
  });

  readonly sparkPathArea = computed(() => {
    const path = this.sparkPath();
    if (!path) return '';
    const last = this.sparkPoints().length - 1;
    return `0,40 ${path} ${last * 10},40`;
  });

  readonly quranPage = computed(() => this.currentUser()?.quranPage ?? 0);
  readonly quranCycle = computed(() => this.currentUser()?.quranCycle ?? 0);
  readonly quranPct = computed(() => Math.round((this.quranPage() / 604) * 100));

  readonly cycleDots = computed(() => Array.from({ length: this.quranCycle() }, (_, i) => i));

  readonly donutStyle = computed(() => {
    const pct = this.quranPct();
    return `conic-gradient(#2da44e 0% ${pct}%, #ebedf0 ${pct}% 100%)`;
  });
}
