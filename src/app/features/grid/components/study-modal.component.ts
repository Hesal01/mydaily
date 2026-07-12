import { Component, input, output, signal, computed } from '@angular/core';
import { User } from '../../../core/models/user.model';
import { SURAHS, getSurah } from '../../../core/constants/surahs.constants';

type SurahState = 'free' | 'taken' | 'completed' | 'mine';

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
          <!-- ===== Sélecteur de sourate ===== -->
          <div class="modal-title">Choisis ta sourate</div>
          <div class="modal-sub">Chacun étudie une sourate différente. Ensemble, on couvre tout le Coran.</div>

          <div class="surah-list">
            @for (s of surahs; track s.number) {
              @let st = surahState(s.number);
              <button
                class="surah-row"
                [class.disabled]="st !== 'free'"
                [disabled]="st !== 'free'"
                (click)="pickSurah(s.number)"
              >
                <span class="s-num">{{ s.number }}</span>
                <span class="s-names">
                  <span class="s-fr">{{ s.nameFr }}</span>
                  <span class="s-ar">{{ s.nameAr }}</span>
                </span>
                <span class="s-ayahs">{{ s.ayahs }} v.</span>
                <span class="s-state">
                  @if (st === 'completed') {
                    <span class="s-check">✓</span>
                  } @else if (st === 'taken' || st === 'mine') {
                    <span class="s-owner">{{ ownerAnimal(s.number) }}</span>
                  }
                </span>
              </button>
            }
          </div>

          <div class="modal-actions">
            <button class="btn-close" (click)="close.emit()">Fermer</button>
          </div>
        } @else {
          <!-- ===== Étude de la sourate en cours ===== -->
          <div class="modal-title">{{ surah()?.nameAr }} · {{ surah()?.nameFr }}</div>
          <div class="modal-sub">Jusqu'à quel verset es-tu arrivé(e) ?</div>

          <div class="current-page">
            Verset {{ verse() }} / {{ ayahs() }}
          </div>

          <div class="quick-buttons">
            <button class="quick-btn" (click)="increment(1)">+1</button>
            <button class="quick-btn" (click)="increment(5)">+5</button>
            <button class="quick-btn" (click)="increment(10)">+10</button>
          </div>

          <div class="select-row">
            <label for="verse-select">Aller au verset :</label>
            <select id="verse-select" [value]="verse()" (change)="onSelectChange($event)">
              @for (v of verseOptions(); track v) {
                <option [value]="v" [selected]="v === verse()">{{ v }}</option>
              }
            </select>
          </div>

          <div class="modal-actions two">
            <button class="btn-primary" (click)="validate()">Valider</button>
            <button class="btn-close" (click)="close.emit()">Fermer</button>
          </div>

          <div class="secondary-row">
            <button class="link-btn" (click)="openSelector()">Changer de sourate</button>
            @if (studyDoneToday()) {
              <button class="link-btn" (click)="onUnmark()">Décocher aujourd'hui</button>
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
      background: #ffffff;
      border-radius: 16px;
      padding: 24px;
      width: min(360px, 92vw);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
    .current-page {
      text-align: center;
      font-size: 24px;
      font-weight: 700;
      color: #ec4899;
      margin-bottom: 20px;
    }
    .quick-buttons {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 20px;
    }
    .quick-btn {
      flex: 1;
      padding: 12px;
      border-radius: 10px;
      border: 2px solid #ec4899;
      background: #ffffff;
      color: #ec4899;
      font-size: 17px;
      font-weight: 600;
      cursor: pointer;
      touch-action: manipulation;
    }
    .quick-btn:active {
      background: #ec4899;
      color: #ffffff;
    }
    .select-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }
    .select-row label {
      font-size: 14px;
      color: #656d76;
    }
    .select-row select {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #d0d7de;
      font-size: 16px;
      background: #f6f8fa;
      color: #1f2328;
      -webkit-appearance: none;
      appearance: none;
    }
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
      background: #ec4899;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      touch-action: manipulation;
    }
    .btn-primary:active { background: #d63384; }
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
    .secondary-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .link-btn {
      background: none;
      border: none;
      color: #656d76;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      padding: 4px;
      text-decoration: underline;
      touch-action: manipulation;
    }

    /* ===== Sélecteur ===== */
    .surah-list {
      max-height: 52vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      border: 1px solid #eaeef2;
      border-radius: 10px;
      margin-bottom: 16px;
    }
    .surah-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: none;
      border-bottom: 1px solid #f0f2f5;
      background: #ffffff;
      cursor: pointer;
      text-align: left;
      touch-action: manipulation;
    }
    .surah-row:last-child { border-bottom: none; }
    .surah-row:active:not(.disabled) { background: #fdf2f8; }
    .surah-row.disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .s-num {
      flex-shrink: 0;
      width: 26px;
      font-size: 12px;
      font-weight: 700;
      color: #ec4899;
      text-align: center;
    }
    .s-names {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .s-fr {
      font-size: 14px;
      font-weight: 600;
      color: #1f2328;
    }
    .s-ar {
      font-size: 13px;
      color: #656d76;
      direction: rtl;
    }
    .s-ayahs {
      flex-shrink: 0;
      font-size: 11px;
      color: #8b949e;
    }
    .s-state {
      flex-shrink: 0;
      width: 26px;
      text-align: center;
      font-size: 18px;
      line-height: 1;
    }
    .s-check { color: #ec4899; font-weight: 800; }

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
  readonly markVerse = output<number>();
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

  private readonly minVerse = computed(() =>
    this.localSurah() !== null ? 0 : (this.currentUser()?.studyVerse ?? 0)
  );
  readonly verseOptions = computed(() => {
    const start = Math.max(1, this.minVerse());
    const end = this.ayahs();
    const out: number[] = [];
    for (let v = start; v <= end; v++) out.push(v);
    return out;
  });

  readonly doneSurahName = computed(() => {
    const n = this.doneSurah();
    return n ? getSurah(n)?.nameFr ?? '' : '';
  });

  // Union of all completed surahs across users.
  private readonly completedSet = computed(() => {
    const set = new Set<number>();
    for (const u of this.allUsers()) {
      for (const n of u.studyCompletedSurahs ?? []) set.add(n);
    }
    return set;
  });

  // surahNumber -> ownerUserId (users with a surah in progress).
  private readonly takenBy = computed(() => {
    const map = new Map<number, string>();
    for (const u of this.allUsers()) {
      if (u.studySurah) map.set(u.studySurah, u.id);
    }
    return map;
  });

  ngOnInit(): void {
    this.verse.set(this.currentUser()?.studyVerse ?? 0);
  }

  surahState(n: number): SurahState {
    if (this.completedSet().has(n)) return 'completed';
    const owner = this.takenBy().get(n);
    if (owner) return owner === this.currentUserId() ? 'mine' : 'taken';
    return 'free';
  }

  ownerAnimal(n: number): string {
    const owner = this.takenBy().get(n);
    if (!owner) return '';
    return this.animalsByUserId()[owner] || '?';
  }

  pickSurah(n: number): void {
    if (this.surahState(n) !== 'free') return;
    this.localSurah.set(n);
    this.verse.set(1);
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

  onSelectChange(event: Event): void {
    this.verse.set(+(event.target as HTMLSelectElement).value);
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
      this.markVerse.emit(v);
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
