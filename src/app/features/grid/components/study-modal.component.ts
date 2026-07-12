import { Component, input, output, signal, computed } from '@angular/core';
import { User } from '../../../core/models/user.model';
import { SURAHS, getSurah } from '../../../core/constants/surahs.constants';

type SelState = 'free' | 'prog' | 'done';

interface CoStudent {
  emoji: string;
  verse: number;
  left: string;
  title: string;
}

@Component({
  selector: 'app-study-modal',
  standalone: true,
  template: `
    <div class="backdrop" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">

        @if (completedView()) {
          <!-- ===== Sourate terminée ===== -->
          <div class="done-view">
            <div class="done-emoji">🎉</div>
            <div class="done-title">Sourate {{ doneSurahName() }} terminée !</div>
            <div class="done-sub">Choisis-en une nouvelle quand tu veux.</div>
            <div class="modal-actions two">
              <button class="btn-primary" (click)="chooseNew()">Nouvelle sourate</button>
              <button class="btn-close" (click)="close.emit()">Fermer</button>
            </div>
          </div>
        } @else if (showSelector()) {
          <!-- ===== Sélecteur enrichi (maquette C) ===== -->
          <div class="modal-title">Choisis ta sourate</div>
          <div class="modal-sub">Chacun étudie une sourate différente. Ensemble, on couvre tout le Coran.</div>

          <div class="surah-list">
            @for (s of surahs; track s.number) {
              @let st = selState(s.number);
              <button
                class="srow"
                [class.join]="st !== 'done'"
                [disabled]="st === 'done'"
                (click)="pickSurah(s.number)"
              >
                <span class="snum num">{{ s.number }}</span>
                <span class="sinfo">
                  <span class="sfr">{{ s.nameFr }}</span>
                  <span class="say num">{{ s.ayahs }} v.</span>
                  @if (st === 'prog') {
                    <span class="tag prog">{{ progEmojis(s.number) }} en cours · rejoindre</span>
                  } @else if (st === 'done') {
                    <span class="tag done">✓ terminée</span>
                  } @else if (progressFor(s.number) > 0) {
                    <span class="tag me num">toi : v. {{ progressFor(s.number) }}</span>
                  }
                </span>
                <span class="ar" lang="ar" dir="rtl">{{ s.nameAr }}</span>
              </button>
            }
          </div>

          <div class="modal-actions">
            <button class="btn-close" (click)="close.emit()">Fermer</button>
          </div>
        } @else {
          <!-- ===== La piste : saisie quotidienne (maquette B) ===== -->
          <div class="m-ar ar" lang="ar" dir="rtl">{{ surah()?.nameAr }}</div>
          <div class="m-sub num">{{ surah()?.nameFr }} · {{ ayahs() }} versets</div>

          <div class="vhead num">verset {{ verse() }} / {{ ayahs() }}@if (delta() > 0) {<span class="vdelta"> +{{ delta() }} aujourd'hui</span>}</div>

          <div class="vtrack">
            <span class="vfill" [style.width.%]="fillPct()"></span>
            @for (c of coStudents(); track c.title) {
              <span class="vrider" [style.left]="c.left" [attr.title]="c.title">{{ c.emoji }}</span>
            }
            <span class="vrider me" [style.left]="myRiderLeft()" [attr.title]="myTitle()">{{ myEmoji() }}</span>
          </div>

          <div class="chips">
            <button class="chip num" (click)="increment(1)">+1</button>
            <button class="chip num" (click)="increment(3)">+3</button>
            <button class="chip num" (click)="increment(5)">+5</button>
            <button class="chip num" (click)="increment(10)">+10</button>
            <span class="minis">
              <button class="mini" (click)="decrement()" aria-label="Reculer d'un verset">−</button>
              <button class="mini" (click)="increment(1)" aria-label="Avancer d'un verset">+</button>
            </span>
          </div>

          <button class="valid" [class.finish]="verse() >= ayahs()" (click)="validate()">
            @if (verse() >= ayahs()) { Terminer la sourate 🎉 } @else { Valider }
          </button>

          <div class="mlinks">
            <span (click)="openSelector()">Changer de sourate</span>
            @if (studyDoneToday()) {
              <span (click)="onUnmark()">Décocher aujourd'hui</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      --gold: #d97706;
      --gold-soft: color-mix(in srgb, #d97706 22%, #ffffff);
      --green: var(--color-success);
      background: #ffffff;
      border-radius: 16px;
      padding: 24px;
      width: min(360px, 92vw);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
    .num { font-variant-numeric: tabular-nums; }
    .ar {
      font-family: 'Geeza Pro', 'Al Bayan', 'Noto Naskh Arabic', 'Amiri', serif;
      color: #1f2328;
      white-space: nowrap;
      line-height: 1.2;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 6px;
      color: #1f2328;
    }
    .modal-sub {
      font-size: 13px;
      text-align: center;
      color: #656d76;
      margin-bottom: 18px;
    }

    /* ===== La piste (maquette B) ===== */
    .m-ar { font-size: 30px; text-align: center; }
    .m-sub {
      font-size: 12px;
      color: #656d76;
      text-align: center;
      margin: 2px 0 16px;
    }
    .vhead {
      text-align: center;
      font-size: 16px;
      font-weight: 700;
      color: #1f2328;
      margin-bottom: 6px;
    }
    .vdelta { font-size: 12px; font-weight: 600; color: var(--green); }
    .vtrack {
      position: relative;
      height: 18px;
      border-radius: 9px;
      background: var(--gold-soft);
      margin: 0 4px 18px;
    }
    .vfill {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      background: var(--green);
      border-radius: 9px;
      transition: width var(--duration-base) var(--ease-out);
    }
    .vrider {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      font-size: 16px;
      line-height: 1;
      z-index: 1;
      pointer-events: none;
    }
    .vrider.me { z-index: 2; }
    .chips {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      margin-bottom: 18px;
    }
    .chip {
      padding: 8px 14px;
      border-radius: 999px;
      border: 0;
      background: var(--color-surface-2);
      font-size: 14px;
      font-weight: 600;
      color: #1f2328;
      cursor: pointer;
      touch-action: manipulation;
    }
    .chip:active { background: var(--green); color: #ffffff; }
    .minis { display: flex; gap: 6px; margin-left: 4px; }
    .mini {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 0;
      background: var(--color-surface-2);
      color: #656d76;
      font-size: 16px;
      cursor: pointer;
      touch-action: manipulation;
    }
    .mini:active { background: var(--color-border); }
    .valid {
      display: block;
      width: 100%;
      padding: 13px;
      border: 0;
      border-radius: 14px;
      background: var(--green);
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      touch-action: manipulation;
    }
    .valid:active { filter: brightness(0.94); }
    .valid.finish { background: var(--gold); }
    .mlinks {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      font-size: 12px;
      color: #656d76;
    }
    .mlinks span {
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
      touch-action: manipulation;
    }

    /* ===== Sélecteur enrichi (maquette C) ===== */
    .surah-list {
      max-height: 52vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      border: 1px solid #eaeef2;
      border-radius: 10px;
      margin-bottom: 16px;
      padding: 0 10px;
    }
    .srow {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 2px;
      border: none;
      border-bottom: 1px solid #eaeef2;
      background: #ffffff;
      text-align: left;
      touch-action: manipulation;
      font-family: inherit;
    }
    .srow:last-child { border-bottom: none; }
    .srow.join { cursor: pointer; }
    .srow.join:active { background: #fbf3e6; }
    .srow[disabled] { cursor: default; }
    .snum {
      width: 20px;
      flex-shrink: 0;
      font-size: 11px;
      color: #656d76;
      text-align: center;
    }
    .sinfo {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .sfr { font-size: 14px; font-weight: 600; color: #1f2328; }
    .say { font-size: 11px; color: #656d76; }
    .tag {
      display: inline-block;
      width: fit-content;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 8px;
      border-radius: 999px;
      margin-top: 3px;
    }
    .tag.done {
      background: var(--gold-soft);
      color: color-mix(in srgb, var(--gold) 78%, #1f2328);
    }
    .tag.prog { background: var(--color-surface-2); color: #1f2328; }
    .tag.me { background: var(--green); color: #ffffff; }
    .srow .ar { font-size: 22px; }

    .modal-actions {
      display: flex;
      justify-content: center;
      gap: 10px;
    }
    .modal-actions.two { margin-bottom: 12px; }
    .btn-primary {
      flex: 1;
      padding: 12px 24px;
      border-radius: 8px;
      border: none;
      background: var(--gold);
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      touch-action: manipulation;
    }
    .btn-primary:active { filter: brightness(0.92); }
    .btn-close {
      flex: 1;
      padding: 12px 24px;
      border-radius: 8px;
      border: 1px solid #d0d7de;
      background: #f6f8fa;
      color: #1f2328;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      touch-action: manipulation;
    }
    .btn-close:active { background: #eaeef2; }

    /* ===== Terminée ===== */
    .done-view {
      text-align: center;
      padding: 8px 0;
    }
    .done-emoji { font-size: 46px; margin-bottom: 10px; }
    .done-title {
      font-size: 20px;
      font-weight: 700;
      color: #1f2328;
      margin-bottom: 8px;
    }
    .done-sub {
      font-size: 14px;
      color: #656d76;
      margin-bottom: 22px;
    }
  `]
})
export class StudyModalComponent {
  readonly currentUser = input<User | null>(null);
  readonly allUsers = input<User[]>([]);
  readonly animalsByUserId = input<Record<string, string>>({});
  readonly currentUserId = input<string | null>(null);
  readonly studyDoneToday = input<boolean>(false);

  readonly selectSurah = output<number>();
  readonly markVerse = output<{ surah: number; verse: number }>();
  readonly completeSurah = output<{ surah: number; verse: number }>();
  readonly unmarkToday = output<void>();
  readonly close = output<void>();

  readonly surahs = SURAHS;

  readonly verse = signal(0);
  private readonly localSurah = signal<number | null>(null);
  private readonly forceSelector = signal(false);
  readonly completedView = signal(false);
  private readonly doneSurah = signal<number | null>(null);

  readonly activeSurahNumber = computed(() =>
    this.localSurah() ?? this.currentUser()?.studySurah ?? null
  );
  readonly showSelector = computed(() =>
    this.forceSelector() || this.activeSurahNumber() === null
  );
  readonly surah = computed(() => {
    const n = this.activeSurahNumber();
    return n ? getSurah(n) : undefined;
  });
  readonly ayahs = computed(() => this.surah()?.ayahs ?? 0);

  // Dernier verset mémorisé pour une sourate donnée (map perso, 0 si absente).
  progressFor(n: number): number {
    return this.currentUser()?.studyProgress?.[String(n)] ?? 0;
  }

  // Plancher = verset atteint à l'ouverture (base du delta du jour).
  private readonly minVerse = computed(() => {
    const local = this.localSurah();
    if (local !== null) return this.progressFor(local);
    return this.currentUser()?.studyVerse ?? 0;
  });

  // Δ du jour : versets ajoutés depuis l'ouverture.
  readonly delta = computed(() => Math.max(0, this.verse() - this.minVerse()));

  readonly fillPct = computed(() => {
    const a = this.ayahs();
    return a > 0 ? Math.round((this.verse() / a) * 100) : 0;
  });

  readonly myEmoji = computed(() => {
    const id = this.currentUserId();
    return (id ? this.animalsByUserId()[id] : '') || '🙂';
  });
  readonly myRiderLeft = computed(() => `clamp(10px, ${this.fillPct()}%, calc(100% - 10px))`);
  readonly myTitle = computed(() => `${this.myEmoji()} v. ${this.verse()}/${this.ayahs()}`);

  // Co-étudiants de la sourate en cours (posés à leur position sur la piste).
  readonly coStudents = computed<CoStudent[]>(() => {
    const n = this.activeSurahNumber();
    const meId = this.currentUserId();
    const a = this.ayahs();
    if (!n) return [];
    return this.allUsers()
      .filter(u => u.id !== meId && u.studySurah === n)
      .map(u => {
        const v = u.studyVerse ?? 0;
        const pct = a > 0 ? Math.round((v / a) * 100) : 0;
        const emoji = this.animalsByUserId()[u.id] || '?';
        return {
          emoji,
          verse: v,
          left: `clamp(10px, ${pct}%, calc(100% - 10px))`,
          title: `${emoji} v. ${v}/${a}`
        };
      });
  });

  readonly doneSurahName = computed(() => {
    const n = this.doneSurah();
    return n ? getSurah(n)?.nameFr ?? '' : '';
  });

  // Union des sourates terminées (tous les membres visibles).
  private readonly completedSet = computed(() => {
    const set = new Set<number>();
    for (const u of this.allUsers()) {
      for (const n of u.studyCompletedSurahs ?? []) set.add(n);
    }
    return set;
  });

  // Sourate en cours -> emojis des membres (max 3 affichés). En cours prime sur terminée.
  private readonly inProgressEmojis = computed(() => {
    const map = new Map<number, string[]>();
    for (const u of this.allUsers()) {
      if (!u.studySurah) continue;
      const em = this.animalsByUserId()[u.id] || '?';
      const list = map.get(u.studySurah);
      if (list) { if (list.length < 3) list.push(em); }
      else map.set(u.studySurah, [em]);
    }
    return map;
  });

  ngOnInit(): void {
    this.verse.set(this.currentUser()?.studyVerse ?? 0);
  }

  selState(n: number): SelState {
    if (this.inProgressEmojis().has(n)) return 'prog';
    if (this.completedSet().has(n)) return 'done';
    return 'free';
  }

  progEmojis(n: number): string {
    return (this.inProgressEmojis().get(n) ?? []).join('');
  }

  // Sélection d'une sourate libre OU « rejoindre » une sourate en cours.
  pickSurah(n: number): void {
    if (this.selState(n) === 'done') return;
    this.localSurah.set(n);
    this.verse.set(Math.max(1, this.progressFor(n)));
    this.forceSelector.set(false);
    this.selectSurah.emit(n);
  }

  openSelector(): void {
    this.forceSelector.set(true);
  }

  increment(amount: number): void {
    const start = Math.max(1, this.minVerse());
    const next = Math.min(this.ayahs(), Math.max(start, this.verse() + amount));
    this.verse.set(next);
  }

  decrement(): void {
    const start = Math.max(1, this.minVerse());
    this.verse.set(Math.max(start, this.verse() - 1));
  }

  validate(): void {
    const s = this.activeSurahNumber();
    const v = this.verse();
    const a = this.ayahs();
    if (!s || v < 1) return;
    if (v >= a) {
      this.doneSurah.set(s);
      this.completeSurah.emit({ surah: s, verse: a });
      this.completedView.set(true);
    } else {
      this.markVerse.emit({ surah: s, verse: v });
      this.close.emit();
    }
  }

  onUnmark(): void {
    this.unmarkToday.emit();
    this.close.emit();
  }

  chooseNew(): void {
    this.completedView.set(false);
    this.doneSurah.set(null);
    this.localSurah.set(null);
    this.verse.set(1);
    this.forceSelector.set(true);
  }
}
