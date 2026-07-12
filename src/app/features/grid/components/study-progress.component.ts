import { Component, input, computed } from '@angular/core';
import { User } from '../../../core/models/user.model';
import { SURAHS, TOTAL_SURAHS, getSurah } from '../../../core/constants/surahs.constants';

interface StudyRow {
  userId: string;
  animal: string;
  nameFr: string;
  verse: number;
  ayahs: number;
  pct: number;
  mine: boolean;
}

interface FrescoCell {
  number: number;
  nameFr: string;
  state: 'free' | 'inProgress' | 'completed';
  animal: string;
}

@Component({
  selector: 'app-study-progress',
  standalone: true,
  template: `
    <div class="study-progress">
      <div class="header">
        <div class="title">Le Coran, ensemble</div>
        <div class="counter">{{ completedCount() }}/{{ total }} sourates étudiées</div>
      </div>

      @if (rows().length > 0) {
        <div class="users-list">
          @for (row of rows(); track row.userId) {
            <div class="user-row" [class.mine]="row.mine">
              <span class="animal">{{ row.animal }}</span>
              <div class="bar-wrapper">
                <div class="label">{{ row.nameFr }}</div>
                <div class="bar-bg">
                  <div class="bar-fill" [style.width.%]="row.pct"></div>
                </div>
              </div>
              <span class="pct">v.{{ row.verse }}/{{ row.ayahs }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="empty">Personne n'a encore choisi de sourate.</div>
      }

      <div class="fresco">
        @for (cell of fresco(); track cell.number) {
          <div
            class="fresco-cell"
            [class.completed]="cell.state === 'completed'"
            [class.in-progress]="cell.state === 'inProgress'"
            [attr.title]="cell.number + '. ' + cell.nameFr"
          >
            @if (cell.state === 'completed') {
              <span class="fc-check">✓</span>
            } @else if (cell.state === 'inProgress') {
              <span class="fc-animal">{{ cell.animal }}</span>
            } @else {
              <span class="fc-num">{{ cell.number }}</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .study-progress {
      padding: 8px 0 16px;
      border-top: 1px solid var(--color-surface-1);
      margin-top: 16px;
    }
    .header {
      text-align: center;
      margin-bottom: 18px;
    }
    .title {
      font-size: 17px;
      font-weight: 600;
      color: var(--color-text);
    }
    .counter {
      font-size: 13px;
      font-weight: 600;
      color: #ec4899;
      margin-top: 2px;
    }
    .users-list {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-bottom: 18px;
    }
    .user-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--color-surface-1);
      opacity: 0.65;
    }
    .user-row:last-child { border-bottom: none; }
    .user-row.mine { opacity: 1; }
    .animal {
      font-size: 22px;
      line-height: 1;
      flex-shrink: 0;
      width: 30px;
      text-align: center;
      color: var(--color-text);
    }
    .user-row.mine .animal { color: #ec4899; }
    .bar-wrapper { flex: 1; min-width: 0; }
    .label {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bar-bg {
      height: 18px;
      background: var(--color-surface-2);
      border-radius: 6px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      background: #ec4899;
      border-radius: 6px;
      transition: width var(--duration-slow) var(--ease-out);
    }
    .pct {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-text-muted);
      flex-shrink: 0;
      min-width: 48px;
      text-align: right;
    }
    .empty {
      text-align: center;
      font-size: 13px;
      color: var(--color-text-muted);
      padding: 8px 0 18px;
    }

    .fresco {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 4px;
    }
    .fresco-cell {
      aspect-ratio: 1;
      border-radius: var(--radius-xs);
      background: var(--color-surface-2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      line-height: 1;
      overflow: hidden;
    }
    .fresco-cell.in-progress {
      background: color-mix(in srgb, #ec4899 15%, var(--color-bg));
    }
    .fresco-cell.completed {
      background: #ec4899;
    }
    .fc-num {
      font-size: 9px;
      font-weight: 600;
      color: var(--color-text-muted);
    }
    .fc-animal { font-size: 13px; }
    .fc-check {
      font-size: 12px;
      font-weight: 800;
      color: #ffffff;
    }
    @media (max-width: 360px) {
      .fc-num { font-size: 8px; }
      .fc-animal { font-size: 11px; }
    }
  `]
})
export class StudyProgressComponent {
  readonly users = input.required<User[]>();
  readonly animalsByUserId = input.required<Record<string, string>>();
  readonly currentUserId = input.required<string | null>();

  readonly total = TOTAL_SURAHS;

  private readonly completedSet = computed(() => {
    const set = new Set<number>();
    for (const u of this.users()) {
      for (const n of u.studyCompletedSurahs ?? []) set.add(n);
    }
    return set;
  });

  readonly completedCount = computed(() => this.completedSet().size);

  // surahNumber -> ownerUserId (in-progress surahs).
  private readonly takenBy = computed(() => {
    const map = new Map<number, string>();
    for (const u of this.users()) {
      if (u.studySurah && !this.completedSet().has(u.studySurah)) {
        map.set(u.studySurah, u.id);
      }
    }
    return map;
  });

  readonly rows = computed<StudyRow[]>(() => {
    const meId = this.currentUserId();
    return this.users()
      .filter(u => !!u.studySurah)
      .map(u => {
        const surah = getSurah(u.studySurah!);
        const ayahs = surah?.ayahs ?? 0;
        const verse = u.studyVerse ?? 0;
        return {
          userId: u.id,
          animal: this.animalsByUserId()[u.id] || '?',
          nameFr: surah?.nameFr ?? '',
          verse,
          ayahs,
          pct: ayahs > 0 ? Math.round((verse / ayahs) * 100) : 0,
          mine: u.id === meId
        };
      });
  });

  readonly fresco = computed<FrescoCell[]>(() => {
    const completed = this.completedSet();
    const taken = this.takenBy();
    return SURAHS.map(s => {
      let state: FrescoCell['state'] = 'free';
      let animal = '';
      if (completed.has(s.number)) {
        state = 'completed';
      } else if (taken.has(s.number)) {
        state = 'inProgress';
        animal = this.animalsByUserId()[taken.get(s.number)!] || '?';
      }
      return { number: s.number, nameFr: s.nameFr, state, animal };
    });
  });
}
