import { Component, input, computed, signal } from '@angular/core';
import { User } from '../../../core/models/user.model';
import { SURAHS, TOTAL_SURAHS } from '../../../core/constants/surahs.constants';

interface StudyRow {
  userId: string;
  animal: string;
  nameFr: string;
  surah: number;
  verse: number;
  ayahs: number;
  pct: number;
  mine: boolean;
}

interface Lane {
  emoji: string;
  verse: number;
  pct: number;
  mine: boolean;
  riderLeft: string;
}

interface FriseSeg {
  number: number;
  nameFr: string;
  ayahs: number;
  flex: string;
  title: string;
  kind: 'done' | 'lanes' | 'gather' | 'free';
  mine: boolean;        // done + terminée par le user courant
  showInName: boolean;  // done + ayahs >= 60
  showName: boolean;    // prog + ayahs >= 40
  lanes: Lane[];
  packEmojis: string[];
  packPlus: number;
}

interface Picked {
  number: number;
  nameFr: string;
  ayahs: number;
}

@Component({
  selector: 'app-study-progress',
  standalone: true,
  template: `
    <div class="study-progress">
      <div class="header">
        <div class="title">Le Coran, ensemble</div>
        <div class="counter num">{{ completedCount() }}/{{ total }} sourates étudiées@if (mineCompletedCount() > 0) {<span class="mine-count"> · dont {{ mineCompletedCount() }} par toi</span>}</div>
      </div>

      <div class="legend">
        <span class="k"><i class="sw done"></i> étudiée</span>
        <span class="k"><i class="sw prog"></i> en cours</span>
        <span class="k"><i class="sw free"></i> libre</span>
        <span class="k"><i class="sw me"></i> toi</span>
      </div>

      <div class="frise">
        @for (seg of segments(); track seg.number) {
          @switch (seg.kind) {
            @case ('done') {
              <div class="seg done" [class.mine]="seg.mine" [style.flex]="seg.flex" [attr.title]="seg.title">
                @if (seg.showInName) { <span class="dinname">{{ seg.nameFr }}</span> }
              </div>
            }
            @case ('gather') {
              <div class="seg prog gather" [style.flex]="seg.flex" [attr.title]="seg.title">
                <span class="dpack">
                  @for (em of seg.packEmojis; track $index) { <span class="pem">{{ em }}</span> }
                  <span class="pplus num">+{{ seg.packPlus }}</span>
                </span>
                @if (seg.showName) { <span class="dname">{{ seg.nameFr }}</span> }
              </div>
            }
            @case ('lanes') {
              <div class="seg prog" [style.flex]="seg.flex" [attr.title]="seg.title">
                @for (lane of seg.lanes; track $index) {
                  <span class="dlane">
                    <span class="dtrace" [class.me]="lane.mine" [style.width.%]="lane.pct"></span>
                    <span class="drider" [style.left]="lane.riderLeft">{{ lane.emoji }}</span>
                  </span>
                }
                @if (seg.showName) { <span class="dname">{{ seg.nameFr }}</span> }
              </div>
            }
            @default {
              <div class="seg free" [style.flex]="seg.flex" [attr.title]="seg.title" (click)="onPickFree(seg)"></div>
            }
          }
        }
      </div>

      <div class="dpick num">
        @if (picked(); as p) {
          <b>{{ p.number }}. {{ p.nameFr }}</b> — {{ p.ayahs }} v.
        } @else {
          Touche une sourate pour voir son nom
        }
      </div>

      @if (rows().length > 0) {
        <div class="crew">
          @for (row of rows(); track row.userId) {
            <div class="crow" [class.me]="row.mine">
              <span class="em">{{ row.animal }}</span>
              <span class="cn">{{ row.nameFr }}</span>
              <span class="cbar"><i [style.width.%]="row.pct"></i></span>
              <span class="cv num">v. {{ row.verse }}/{{ row.ayahs }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="empty">Personne n'a encore choisi de sourate.</div>
      }
    </div>
  `,
  styles: [`
    .study-progress {
      --gold: #d97706;
      --gold-soft: color-mix(in srgb, #d97706 22%, #ffffff);
      --gold-line: color-mix(in srgb, #d97706 45%, transparent);
      --green: var(--color-success);
      --free: var(--color-surface-2);
      padding: 8px 0 16px;
      border-top: 1px solid var(--color-surface-1);
      margin-top: 16px;
    }
    .num { font-variant-numeric: tabular-nums; }

    .header {
      text-align: center;
      margin-bottom: 6px;
    }
    .title {
      font-size: 17px;
      font-weight: 600;
      color: var(--color-text);
    }
    .counter {
      font-size: 13px;
      font-weight: 600;
      color: var(--gold);
      margin-top: 2px;
    }
    .mine-count { color: var(--green); }

    .legend {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--color-text-muted);
      margin: 2px 0 18px;
    }
    .legend .k { display: inline-flex; align-items: center; gap: 6px; }
    .sw { width: 13px; height: 13px; border-radius: 3px; display: inline-block; }
    .sw.done { background: var(--gold); }
    .sw.prog { background: var(--gold-soft); box-shadow: inset 0 0 0 1.5px var(--gold-line); }
    .sw.free { background: var(--free); }
    .sw.me { background: var(--green); }

    /* ===== Frise caravane ===== */
    .frise {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      row-gap: 14px;
      align-content: flex-start;
    }
    .seg {
      height: 34px;
      min-width: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      position: relative;
      overflow: visible;
      transition: background var(--duration-base) ease;
    }
    .seg.done { background: var(--gold); }
    .seg.done.mine { background: var(--green); }
    .seg.prog {
      background: var(--gold-soft);
      box-shadow: inset 0 0 0 1.5px var(--gold-line);
      flex-direction: column;
      align-items: stretch;
      gap: 2px;
    }
    .seg.prog.gather {
      flex-direction: row;
      align-items: center;
      justify-content: center;
    }
    .seg.free { background: var(--free); cursor: pointer; }

    .dlane { position: relative; flex: 1; min-height: 0; }
    .dtrace {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      background: var(--gold);
      border-radius: 3px;
    }
    .dtrace.me { background: var(--green); }
    .drider {
      position: absolute;
      top: 50%;
      z-index: 1;
      font-size: 14px;
      line-height: 1;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .dpack { position: relative; z-index: 1; display: flex; align-items: center; }
    .dpack .pem { font-size: 14px; line-height: 1; margin-left: -5px; }
    .dpack .pem:first-child { margin-left: 0; }
    .pplus {
      font-size: 10px;
      font-weight: 700;
      color: var(--color-text-muted);
      background: var(--color-bg);
      border-radius: 999px;
      padding: 1px 5px;
      margin-left: 3px;
    }
    .dinname {
      position: relative;
      z-index: 1;
      font-size: 9px;
      font-weight: 600;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      padding: 0 3px;
    }
    .dname {
      position: absolute;
      top: calc(100% + 1px);
      left: 50%;
      transform: translateX(-50%);
      font-size: 8.5px;
      font-weight: 600;
      color: var(--color-text);
      white-space: nowrap;
      background: var(--color-bg);
      padding: 0 3px;
      border-radius: 3px;
      z-index: 2;
      pointer-events: none;
    }

    .dpick {
      text-align: center;
      font-size: 12px;
      color: var(--color-text-muted);
      margin-top: 10px;
      min-height: 18px;
    }
    .dpick b { color: var(--color-text); font-weight: 600; }

    /* ===== Rangées membres ===== */
    .crew {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
    }
    .crow {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 4px;
      border-bottom: 1px solid var(--color-surface-2);
      font-size: 12px;
      border-radius: 6px;
    }
    .crow:last-child { border-bottom: none; }
    .crow.me { background: color-mix(in srgb, var(--green) 8%, var(--color-bg)); }
    .crow .em { width: 24px; text-align: center; font-size: 16px; flex-shrink: 0; }
    .crow .cn {
      width: 78px;
      flex-shrink: 0;
      font-weight: 600;
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cbar {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      background: var(--free);
      overflow: hidden;
    }
    .cbar i {
      display: block;
      height: 100%;
      background: var(--gold);
      border-radius: 4px;
      transition: width var(--duration-slow) var(--ease-out);
    }
    .crow.me .cbar i { background: var(--green); }
    .cv {
      flex-shrink: 0;
      min-width: 58px;
      text-align: right;
      color: var(--color-text-muted);
      font-weight: 600;
    }
    .empty {
      text-align: center;
      font-size: 13px;
      color: var(--color-text-muted);
      padding: 14px 0 8px;
    }
  `]
})
export class StudyProgressComponent {
  readonly users = input.required<User[]>();
  readonly animalsByUserId = input.required<Record<string, string>>();
  readonly currentUserId = input.required<string | null>();

  readonly total = TOTAL_SURAHS;

  readonly picked = signal<Picked | null>(null);

  private readonly nameByNumber = new Map<number, string>(SURAHS.map(s => [s.number, s.nameFr]));
  private readonly ayahsByNumber = new Map<number, number>(SURAHS.map(s => [s.number, s.ayahs]));

  // Union des sourates terminées par tous les membres visibles.
  private readonly completedSet = computed(() => {
    const set = new Set<number>();
    for (const u of this.users()) {
      for (const n of u.studyCompletedSurahs ?? []) set.add(n);
    }
    return set;
  });

  // Sourates terminées par le user courant (colorées en vert + comptées « par toi »).
  private readonly mineCompletedSet = computed(() => {
    const meId = this.currentUserId();
    const me = this.users().find(u => u.id === meId);
    return new Set<number>(me?.studyCompletedSurahs ?? []);
  });

  readonly completedCount = computed(() => this.completedSet().size);
  readonly mineCompletedCount = computed(() => this.mineCompletedSet().size);

  // Sourate en cours -> membres qui l'étudient (prime sur « terminée »).
  private readonly inProgress = computed(() => {
    const meId = this.currentUserId();
    const map = new Map<number, Lane[]>();
    for (const u of this.users()) {
      const n = u.studySurah;
      if (!n) continue;
      const ayahs = this.ayahsByNumber.get(n) ?? 0;
      const verse = u.studyVerse ?? 0;
      const pct = ayahs > 0 ? Math.round((verse / ayahs) * 100) : 0;
      const lane: Lane = {
        emoji: this.animalsByUserId()[u.id] || '?',
        verse,
        pct,
        mine: u.id === meId,
        riderLeft: `clamp(9px, ${pct}%, calc(100% - 9px))`
      };
      const list = map.get(n);
      if (list) list.push(lane); else map.set(n, [lane]);
    }
    return map;
  });

  readonly segments = computed<FriseSeg[]>(() => {
    const completed = this.completedSet();
    const mine = this.mineCompletedSet();
    const prog = this.inProgress();
    return SURAHS.map(s => {
      const base = Math.max(4, Math.round(s.ayahs * 0.5));
      const flex = `${s.ayahs} 1 ${base}px`;
      const seg: FriseSeg = {
        number: s.number,
        nameFr: s.nameFr,
        ayahs: s.ayahs,
        flex,
        title: `${s.number}. ${s.nameFr} — ${s.ayahs} v.`,
        kind: 'free',
        mine: false,
        showInName: false,
        showName: false,
        lanes: [],
        packEmojis: [],
        packPlus: 0
      };

      const members = prog.get(s.number);
      if (members && members.length > 0) {
        seg.title = members.map(m => `${m.emoji} v. ${m.verse}/${s.ayahs}`).join(' · ') + ` — ${s.nameFr}`;
        seg.showName = s.ayahs >= 40;
        if (members.length >= 4) {
          seg.kind = 'gather';
          seg.packEmojis = members.slice(0, 3).map(m => m.emoji);
          seg.packPlus = members.length - 3;
        } else {
          seg.kind = 'lanes';
          seg.lanes = members;
        }
      } else if (completed.has(s.number)) {
        seg.kind = 'done';
        seg.mine = mine.has(s.number);
        seg.showInName = s.ayahs >= 60;
      }
      return seg;
    });
  });

  // Une rangée par membre actif visible, groupées par sourate (numéro croissant).
  readonly rows = computed<StudyRow[]>(() => {
    const meId = this.currentUserId();
    return this.users()
      .filter(u => !!u.studySurah)
      .map(u => {
        const surah = u.studySurah!;
        const ayahs = this.ayahsByNumber.get(surah) ?? 0;
        const verse = u.studyVerse ?? 0;
        return {
          userId: u.id,
          animal: this.animalsByUserId()[u.id] || '?',
          nameFr: this.nameByNumber.get(surah) ?? '',
          surah,
          verse,
          ayahs,
          pct: ayahs > 0 ? Math.round((verse / ayahs) * 100) : 0,
          mine: u.id === meId
        };
      })
      .sort((a, b) => a.surah - b.surah);
  });

  onPickFree(seg: FriseSeg): void {
    this.picked.set({ number: seg.number, nameFr: seg.nameFr, ayahs: seg.ayahs });
  }
}
