import { Component, input, output, signal, computed } from '@angular/core';
import { User } from '../../../core/models/user.model';
import { getSurah } from '../../../core/constants/surahs.constants';
import { isInitialsBadge } from '../../../core/constants/habits.constants';

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
        <button class="x" (click)="close.emit()" aria-label="Fermer">✕</button>

        @if (completedView()) {
          <!-- ===== Sourate terminée ===== -->
          <div class="done-view">
            <div class="done-emoji">🎉</div>
            <div class="done-title">Sourate {{ doneSurahName() }} terminée !</div>
            <div class="done-sub">Choisis-en une nouvelle quand tu veux.</div>
            <div class="modal-actions two">
              <button class="btn-primary" (click)="goToList.emit()">Nouvelle sourate</button>
              <button class="btn-close" (click)="close.emit()">Fermer</button>
            </div>
          </div>
        } @else if (!activeSurahNumber()) {
          <!-- ===== Aucune sourate en cours : le choix se fait dans l'écran Étude ===== -->
          <div class="done-view">
            <div class="done-emoji">📖</div>
            <div class="done-title">Aucune sourate en cours</div>
            <div class="done-sub">La liste des 114 sourates est sur l'écran Étude : touche celle que tu veux commencer.</div>
            <div class="modal-actions two">
              <button class="btn-primary" (click)="goToList.emit()">Voir la liste</button>
              <button class="btn-close" (click)="close.emit()">Fermer</button>
            </div>
          </div>
        } @else {
          <!-- ===== La piste : saisie quotidienne (maquette B) ===== -->
          <div class="m-ar ar" lang="ar" dir="rtl">{{ surah()?.nameAr }}</div>
          <div class="m-sub num">{{ surah()?.nameFr }} · {{ ayahs() }} versets</div>

          <div class="vhead num">verset {{ verse() }} / {{ ayahs() }}@if (delta() > 0) {<span class="vdelta"> +{{ delta() }} aujourd'hui</span>}</div>

          <div class="vtrack">
            <span class="vfill" [style.width.%]="fillPct()"></span>
            @for (c of coStudents(); track c.title) {
              <span class="vrider" [class.initials]="isInitials(c.emoji)" [style.left]="c.left" [attr.title]="c.title">{{ c.emoji }}</span>
            }
            <span class="vrider me" [class.initials]="isInitials(myEmoji())" [style.left]="myRiderLeft()" [attr.title]="myTitle()">{{ myEmoji() }}</span>
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

          @if (confirmReset()) {
            <div class="mlinks confirm">
              <span class="ask">Effacer ton avancée sur cette sourate ?</span>
              <span class="yes" (click)="doReset()">Oui, repartir de zéro</span>
              <span (click)="confirmReset.set(false)">Annuler</span>
            </div>
          } @else {
            <div class="mlinks">
              @if (!fromList()) {
                <span (click)="goToList.emit()">Voir toutes les sourates</span>
              }
              @if (verse() > 0) {
                <span (click)="confirmReset.set(true)">Repartir de zéro</span>
              }
              @if (studyDoneToday()) {
                <span (click)="onUnmark()">Décocher aujourd'hui</span>
              }
            </div>
          }
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
      position: relative;
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
    .x {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 30px;
      height: 30px;
      border: none;
      border-radius: 50%;
      background: none;
      color: #656d76;
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      touch-action: manipulation;
    }
    .x:active { background: var(--color-surface-2); }
    .ar {
      font-family: 'Geeza Pro', 'Al Bayan', 'Noto Naskh Arabic', 'Amiri', serif;
      color: #1f2328;
      white-space: nowrap;
      line-height: 1.2;
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
    /* Le badge chevauche la piste : une pastille le décolle du fond. */
    .vrider {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.10), 0 1px 2px rgba(15, 23, 42, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
      z-index: 1;
      pointer-events: none;
    }
    .vrider.me { z-index: 2; }
    .vrider.initials { font-size: 10px; font-weight: 700; color: #1f2328; }
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
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px 16px;
      margin-top: 12px;
      font-size: 12px;
      color: #656d76;
    }
    .mlinks.confirm { flex-direction: column; align-items: center; gap: 8px; }
    .mlinks .ask { text-decoration: none; cursor: default; color: #1f2328; font-weight: 600; }
    .mlinks .yes { color: var(--gold); font-weight: 600; }
    .mlinks span {
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
      touch-action: manipulation;
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
  readonly badgesByUserId = input<Record<string, string>>({});
  readonly currentUserId = input<string | null>(null);
  readonly studyDoneToday = input<boolean>(false);
  /**
   * Sourate sur laquelle ouvrir la piste. La liste vient peut-être de
   * l'enregistrer côté Firestore : on ne peut pas attendre que `currentUser`
   * ait rattrapé son retard pour afficher le bon verset.
   */
  readonly initialSurah = input<number | null>(null);
  /**
   * La piste a été ouverte depuis la liste : inutile d'y proposer un lien
   * vers la liste, elle est juste derrière la modale.
   */
  readonly fromList = input<boolean>(false);
  readonly isInitials = isInitialsBadge;

  readonly markVerse = output<{ surah: number; verse: number }>();
  readonly completeSurah = output<{ surah: number; verse: number }>();
  readonly unmarkToday = output<void>();
  /** Remise à zéro de MON avancée sur cette sourate (l'ancien verset permet d'annuler). */
  readonly resetSurah = output<{ surah: number; previousVerse: number }>();
  readonly close = output<void>();
  /** Renvoie vers l'écran Étude, seul endroit où l'on choisit sa sourate. */
  readonly goToList = output<void>();

  readonly verse = signal(0);
  readonly confirmReset = signal(false);
  /**
   * Plancher forcé après une remise à zéro : le doc user met un instant à
   * revenir de Firestore, et sans ça le premier « +1 » repartirait de l'ancien
   * verset.
   */
  private readonly localFloor = signal<number | null>(null);
  private readonly localSurah = signal<number | null>(null);
  readonly completedView = signal(false);
  private readonly doneSurah = signal<number | null>(null);

  readonly activeSurahNumber = computed(() =>
    this.localSurah() ?? this.initialSurah() ?? this.currentUser()?.studySurah ?? null
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
    const floor = this.localFloor();
    if (floor !== null) return floor;
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
    return (id ? this.badgesByUserId()[id] : '') || '?';
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
        const emoji = this.badgesByUserId()[u.id] || '?';
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

  ngOnInit(): void {
    const target = this.initialSurah();
    const current = this.currentUser()?.studySurah ?? null;
    if (target !== null && target !== current) {
      // Sourate rejointe ou reprise depuis la liste : on repart de sa mémoire.
      this.verse.set(Math.max(1, this.progressFor(target)));
    } else {
      this.verse.set(this.currentUser()?.studyVerse ?? 0);
    }
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

  doReset(): void {
    const surah = this.activeSurahNumber();
    if (!surah) return;
    this.resetSurah.emit({ surah, previousVerse: this.verse() });
    this.localFloor.set(0);
    this.verse.set(0);
    this.confirmReset.set(false);
  }

  onUnmark(): void {
    this.unmarkToday.emit();
    this.close.emit();
  }
}
