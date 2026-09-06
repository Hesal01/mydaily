import { Component, input, output, computed, signal } from '@angular/core';
import { User } from '../../../core/models/user.model';
import { SURAHS, TOTAL_SURAHS } from '../../../core/constants/surahs.constants';
import { isInitialsBadge } from '../../../core/constants/habits.constants';

interface Lane {
  badge: string;
  /** Dernier verset entendu par le relecteur (ou simplement atteint, sans relecteur). */
  verse: number;
  /** Verset annoncé et pas encore entendu — 0 quand il n'y a rien en attente. */
  claim: number;
  pct: number;
  claimPct: number;
  mine: boolean;
  riderLeft: string;
}

/** Une annonce en attente, telle que la voit le relecteur. */
interface ClaimRow {
  userId: string;
  badge: string;
  surah: number;
  nameFr: string;
  ayahs: number;
  from: number;
  to: number;
  age: string;
  finishes: boolean;
}

/** Sourate en cours : la carte détaillée du haut d'écran. */
interface ActiveCard {
  number: number;
  nameFr: string;
  nameAr: string;
  ayahs: number;
  meta: string;
  lanes: Lane[];
  extra: number;
  mine: boolean;
  action: string;
  hint: string;
  /** Versets annoncés sur cette sourate, tous membres confondus. */
  pending: number;
}

interface DoneRow {
  number: number;
  nameFr: string;
  badges: string[];
  extra: number;
  mine: boolean;
}

interface FreeRow {
  number: number;
  nameFr: string;
  nameAr: string;
  ayahs: number;
  myVerse: number;
}

/** Un des 114 segments de la bande du haut (vue d'ensemble du Coran). */
interface Seg {
  number: number;
  flex: string;
  title: string;
  kind: 'done' | 'prog' | 'free';
  mine: boolean;
}

@Component({
  selector: 'app-study-progress',
  standalone: true,
  template: `
    <div class="study">
      <div class="head">
        <div class="title">Étude</div>
        <div class="counter num">{{ completedCount() }}/{{ total }} sourates@if (mineCompletedCount() > 0) {<span class="mine-count"> · dont {{ mineCompletedCount() }} par toi</span>}</div>
      </div>

      <div class="legend">
        <span class="k"><i class="sw done"></i> la famille</span>
        <span class="k"><i class="sw me"></i> toi</span>
        <span class="k"><i class="sw prog"></i> en cours</span>
        @if (validatorId()) {
          <span class="k"><i class="sw wait"></i> annoncé à {{ validatorBadge() }}</span>
        }
      </div>

      <div class="frise">
        @for (seg of segments(); track seg.number) {
          <i
            class="fseg"
            [class.done]="seg.kind === 'done'"
            [class.prog]="seg.kind === 'prog'"
            [class.mine]="seg.mine"
            [style.flex]="seg.flex"
            [attr.title]="seg.title"
            (click)="jumpTo(seg.number)"
          ></i>
        }
      </div>

      <div class="search">
        <i class="ph ph-magnifying-glass"></i>
        <input
          type="search"
          inputmode="search"
          placeholder="Chercher une sourate ou un numéro"
          [value]="query()"
          (input)="onQuery($event)"
        />
        @if (query()) {
          <button class="clear" (click)="clearQuery()" aria-label="Effacer la recherche">✕</button>
        }
      </div>

      @if (claimRows().length > 0) {
        <div class="sechead">
          <span class="l">À valider</span>
          <span class="r num">{{ claimRows().length }} · {{ claimRows()[0].age }}</span>
        </div>
        <div class="stack">
          @for (row of claimRows(); track row.userId) {
            <div class="qrow">
              <span class="qwho" [class.initials]="isInitials(row.badge)">{{ row.badge }}</span>
              <span class="qtxt">
                <span class="qt">
                  @if (row.finishes) { {{ row.nameFr }} terminée }
                  @else { {{ row.nameFr }}, versets {{ row.from }} à {{ row.to }} }
                </span>
                <span class="qs num">{{ row.age }} · {{ row.to - row.from + 1 }} versets</span>
              </span>
              <button class="qok" (click)="validateClaim.emit(row)">✓</button>
            </div>
          }
        </div>
      }

      @if (activeCards().length > 0) {
        <div class="sechead">
          <span class="l">En cours</span>
          <span class="r num">{{ activeSummary() }}</span>
        </div>
        <div class="stack">
          @for (card of activeCards(); track card.number) {
            <button class="card" [id]="'s' + card.number" [class.mine]="card.mine" (click)="openSurah.emit(card.number)">
              <span class="crow">
                <span class="cnum num">{{ card.number }}</span>
                <span class="cname">{{ card.nameFr }}</span>
                <span class="car ar" lang="ar" dir="rtl">{{ card.nameAr }}</span>
              </span>
              <span class="cmeta num">{{ card.meta }}</span>
              @for (lane of card.lanes; track $index) {
                <span class="lane">
                  <span class="track">
                    <b [class.me]="lane.mine" [style.width.%]="lane.pct"></b>
                    @if (lane.claim > 0) {
                      <u [style.left.%]="lane.pct" [style.width.%]="lane.claimPct - lane.pct"></u>
                    }
                    <span class="rider" [class.initials]="isInitials(lane.badge)" [style.left]="lane.riderLeft">{{ lane.badge }}</span>
                  </span>
                  <span class="v num" [class.me]="lane.mine">
                    @if (lane.claim > 0) {
                      {{ lane.verse }} <em class="w">+{{ lane.claim - lane.verse }}</em>
                    } @else {
                      v. {{ lane.verse }}/{{ card.ayahs }}
                    }
                  </span>
                </span>
              }
              @if (card.extra > 0) {
                <span class="cextra num">+ {{ card.extra }} autres sur cette sourate</span>
              }
              <span class="cfoot">
                <span class="act" [class.pri]="card.mine">{{ card.action }}</span>
                @if (card.pending > 0 && !isValidator()) {
                  <span class="wait num">{{ card.pending }} en attente de {{ validatorBadge() }}</span>
                } @else if (card.hint) {
                  <span class="hint num">{{ card.hint }}</span>
                }
              </span>
            </button>
          }
        </div>
      }

      @if (doneRows().length > 0) {
        <div class="sechead tap" (click)="doneOpen.set(!doneOpen())">
          <span class="l">Terminées</span>
          <span class="r num">{{ doneRows().length }} · {{ doneOpen() ? 'replier' : 'déplier' }}</span>
        </div>
        @if (doneOpen()) {
          <div class="stack">
            @for (row of doneRows(); track row.number) {
              <div class="row done" [id]="'s' + row.number">
                <span class="n num">{{ row.number }}</span>
                <span class="nm">{{ row.nameFr }}</span>
                <span class="tag ok" [class.me]="row.mine">✓</span>
                <span class="who">
                  @for (b of row.badges; track $index) { <span class="wb" [class.initials]="isInitials(b)">{{ b }}</span> }
                  @if (row.extra > 0) { <span class="wp num">+{{ row.extra }}</span> }
                </span>
              </div>
            }
          </div>
        }
      }

      <div class="sechead">
        <span class="l">Libres</span>
        <span class="r num">{{ freeRows().length }}</span>
      </div>
      @if (freeRows().length > 0) {
        <div class="stack">
          @for (row of freeRows(); track row.number) {
            <button class="row" [id]="'s' + row.number" (click)="openSurah.emit(row.number)">
              <span class="n num">{{ row.number }}</span>
              <span class="nm">{{ row.nameFr }}</span>
              <span class="ay num">{{ row.ayahs }} v.</span>
              @if (row.myVerse > 0) { <span class="tag me num">toi : v. {{ row.myVerse }}</span> }
              <span class="ar" lang="ar" dir="rtl">{{ row.nameAr }}</span>
            </button>
          }
        </div>
      } @else {
        <div class="empty">Aucune sourate libre ne correspond.</div>
      }
    </div>
  `,
  styles: [`
    .study {
      --gold: #d97706;
      --gold-soft: color-mix(in srgb, #d97706 22%, #ffffff);
      --gold-line: color-mix(in srgb, #d97706 45%, transparent);
      --green: var(--color-success);
      --green-soft: color-mix(in srgb, #2da44e 12%, #ffffff);
      --green-line: color-mix(in srgb, #2da44e 55%, transparent);
      padding-bottom: 24px;
    }
    .num { font-variant-numeric: tabular-nums; }
    .ar {
      font-family: 'Geeza Pro', 'Al Bayan', 'Noto Naskh Arabic', 'Amiri', serif;
      line-height: 1.2;
    }

    .head { text-align: center; padding: 12px 16px 0; }
    .title { font-size: 17px; font-weight: 600; color: var(--color-text); }
    .counter {
      font-size: 13px;
      font-weight: 600;
      color: var(--gold);
      margin-top: 2px;
    }
    .mine-count { color: var(--green); }

    .legend {
      display: flex;
      gap: 14px;
      justify-content: center;
      flex-wrap: wrap;
      font-size: 11.5px;
      color: var(--color-text-muted);
      margin: 7px 0 9px;
    }
    .legend .k { display: inline-flex; align-items: center; gap: 5px; }
    .sw { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
    .sw.done { background: var(--gold); }
    .sw.prog { background: var(--gold-soft); box-shadow: inset 0 0 0 1.5px var(--gold-line); }
    .sw.me { background: var(--green); }

    /* ===== Bande des 114 sourates : la vue d'ensemble, en une ligne ===== */
    .frise {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5px;
      row-gap: 2.5px;
      padding: 0 16px 14px;
    }
    .fseg {
      height: 9px;
      min-width: 3px;
      border-radius: 2px;
      background: var(--color-surface-2);
      display: block;
      cursor: pointer;
    }
    .fseg.done { background: var(--gold); }
    .fseg.done.mine { background: var(--green); }
    .fseg.prog { background: var(--gold-soft); box-shadow: inset 0 0 0 1px var(--gold-line); }
    .fseg.prog.mine { background: var(--green-soft); box-shadow: inset 0 0 0 1px var(--green-line); }

    .search {
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 0 16px 4px;
      padding: 7px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-pill);
      background: var(--color-surface-1);
      color: var(--color-text-muted);
    }
    .search input {
      flex: 1;
      min-width: 0;
      border: none;
      background: none;
      outline: none;
      font-family: inherit;
      font-size: 13px;
      color: var(--color-text);
      -webkit-appearance: none;
    }
    .search input::-webkit-search-cancel-button { display: none; }
    .search .clear {
      border: none;
      background: none;
      color: var(--color-text-muted);
      font-size: 13px;
      padding: 0 2px;
      cursor: pointer;
      touch-action: manipulation;
    }

    /* ===== En-têtes de section, collants au défilement ===== */
    .sechead {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      padding: 16px 16px 6px;
      position: sticky;
      top: 0;
      background: var(--color-bg);
      z-index: 3;
    }
    .sechead.tap { cursor: pointer; touch-action: manipulation; }
    .sechead .l {
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .sechead .r { font-size: 11.5px; color: var(--color-text-muted); }

    /* ===== Cartes et lignes : collées, séparées par un filet ===== */
    .stack {
      border-top: 1px solid var(--color-surface-2);
      border-bottom: 1px solid var(--color-surface-2);
    }
    .card {
      display: block;
      width: 100%;
      text-align: left;
      font-family: inherit;
      border: none;
      border-bottom: 1px solid var(--color-surface-2);
      background: var(--color-bg);
      color: var(--color-text);
      padding: 11px 16px 12px;
      cursor: pointer;
      touch-action: manipulation;
    }
    .card:last-child { border-bottom: none; }
    .card:active { background: var(--color-surface-1); }
    .card.mine {
      background: var(--green-soft);
      box-shadow: inset 3px 0 0 var(--green);
    }
    .card.mine:active { background: color-mix(in srgb, var(--green) 18%, #ffffff); }

    .crow { display: flex; align-items: baseline; gap: 7px; }
    .cnum {
      font-size: 11px;
      font-weight: 700;
      color: var(--color-text-muted);
      min-width: 20px;
    }
    .cname { font-size: 14.5px; font-weight: 600; }
    .car { margin-left: auto; font-size: 17px; color: var(--color-text); }
    .cmeta {
      display: block;
      font-size: 11px;
      color: var(--color-text-muted);
      margin: 1px 0 8px 27px;
    }

    .lane {
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 7px 0 0 27px;
    }
    .track {
      position: relative;
      flex: 1;
      height: 9px;
      border-radius: 5px;
      background: var(--color-surface-2);
    }
    .track b {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      border-radius: 5px;
      background: var(--gold);
      display: block;
      transition: width var(--duration-slow) var(--ease-out);
    }
    .track b.me { background: var(--green); }
    /* Versets annoncés, pas encore entendus par le relecteur. */
    .track u {
      position: absolute;
      top: 0; bottom: 0;
      border-radius: 0 5px 5px 0;
      text-decoration: none;
      background: repeating-linear-gradient(115deg, #f3c98a 0 4px, #fbe6c8 4px 8px);
      box-shadow: inset 0 0 0 1px var(--gold-line);
    }
    /* Le badge est posé au bout de la trace : la pastille le décolle du fond. */
    .rider {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--color-bg);
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.10), 0 1px 2px rgba(15, 23, 42, 0.10);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      line-height: 1;
      pointer-events: none;
    }
    .rider.initials { font-size: 9px; font-weight: 700; }
    .lane .v {
      flex-shrink: 0;
      min-width: 56px;
      text-align: right;
      font-size: 10.5px;
      color: var(--color-text-muted);
    }
    .lane .v.me { color: var(--green); font-weight: 600; }
    .cextra {
      display: block;
      font-size: 10.5px;
      color: var(--color-text-muted);
      margin: 6px 0 0 27px;
    }
    .cfoot {
      display: flex;
      align-items: center;
      gap: 9px;
      margin: 10px 0 0 27px;
    }
    .act {
      font-size: 11.5px;
      font-weight: 600;
      padding: 5px 11px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--color-border);
      background: var(--color-bg);
      color: var(--color-text);
    }
    .act.pri { background: var(--green); border-color: var(--green); color: #ffffff; }
    .cfoot .hint { font-size: 10.5px; color: var(--color-text-muted); }
    .cfoot .wait {
      font-size: 10.5px;
      font-weight: 600;
      color: color-mix(in srgb, var(--gold) 80%, #1f2328);
    }
    .lane .v .w { font-style: normal; font-weight: 700; color: color-mix(in srgb, var(--gold) 80%, #1f2328); }
    .sw.wait { background: repeating-linear-gradient(115deg, #f3c98a 0 3px, #fbe6c8 3px 6px); box-shadow: inset 0 0 0 1px var(--gold-line); }

    /* ===== File du relecteur ===== */
    .qrow {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--color-surface-2);
      background: var(--color-bg);
    }
    .qrow:last-child { border-bottom: none; }
    .qwho { width: 22px; text-align: center; font-size: 15px; flex-shrink: 0; }
    .qwho.initials { font-size: 11px; font-weight: 700; }
    .qtxt { flex: 1; min-width: 0; }
    .qtxt .qt { display: block; font-size: 12.5px; font-weight: 600; }
    .qtxt .qs { display: block; font-size: 10.5px; color: var(--color-text-muted); }
    .qok {
      flex-shrink: 0;
      border: none;
      border-radius: var(--radius-pill);
      background: var(--green);
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      padding: 7px 16px;
      cursor: pointer;
      touch-action: manipulation;
    }
    .qok:active { filter: brightness(0.94); }

    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      text-align: left;
      font-family: inherit;
      padding: 9px 16px;
      border: none;
      border-bottom: 1px solid var(--color-surface-2);
      background: var(--color-bg);
      color: var(--color-text);
      touch-action: manipulation;
    }
    .row:last-child { border-bottom: none; }
    button.row { cursor: pointer; }
    button.row:active { background: var(--color-surface-1); }
    .row .n {
      font-size: 11px;
      font-weight: 700;
      color: var(--color-text-muted);
      min-width: 20px;
      flex-shrink: 0;
    }
    .row .nm {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row.done .nm { color: var(--color-text-muted); }
    .row .ay { font-size: 10.5px; color: var(--color-text-muted); flex-shrink: 0; }
    .row .ar { margin-left: auto; font-size: 15px; color: var(--color-text-muted); flex-shrink: 0; }
    .row .who { margin-left: auto; display: flex; align-items: center; gap: 1px; flex-shrink: 0; }
    .row .wb { font-size: 13px; line-height: 1; }
    .row .wb.initials { font-size: 10px; font-weight: 700; }
    .row .wp { font-size: 10px; font-weight: 700; color: var(--color-text-muted); margin-left: 2px; }
    .tag {
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: var(--radius-pill);
      background: var(--color-surface-1);
      color: var(--color-text-muted);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .tag.ok { background: var(--gold-soft); color: color-mix(in srgb, var(--gold) 80%, #1f2328); }
    .tag.ok.me { background: color-mix(in srgb, var(--green) 18%, #ffffff); color: var(--color-success-dark); }
    .tag.me { background: color-mix(in srgb, var(--green) 14%, #ffffff); color: var(--color-success-dark); }

    .empty {
      text-align: center;
      font-size: 12.5px;
      color: var(--color-text-muted);
      padding: 14px 16px;
    }
  `]
})
export class StudyProgressComponent {
  readonly users = input.required<User[]>();
  readonly badgesByUserId = input.required<Record<string, string>>();
  readonly currentUserId = input.required<string | null>();

  /** Le relecteur du salon, s'il y en a un : lui seul voit la file « À valider ». */
  readonly validatorId = input<string | null>(null);

  /** Ouvrir la piste sur cette sourate (la choisir si ce n'est pas déjà la sienne). */
  readonly openSurah = output<number>();
  /** Feu vert du relecteur sur une annonce. */
  readonly validateClaim = output<ClaimRow>();

  readonly isInitials = isInitialsBadge;
  readonly total = TOTAL_SURAHS;

  readonly query = signal('');
  readonly doneOpen = signal(true);

  private readonly ayahsByNumber = new Map<number, number>(SURAHS.map(s => [s.number, s.ayahs]));
  private readonly nameByNumber = new Map<number, string>(SURAHS.map(s => [s.number, s.nameFr]));

  private readonly me = computed(() => {
    const id = this.currentUserId();
    return this.users().find(u => u.id === id) ?? null;
  });

  // Union des sourates terminées par tous les membres visibles.
  private readonly completedSet = computed(() => {
    const set = new Set<number>();
    for (const u of this.users()) {
      for (const n of u.studyCompletedSurahs ?? []) set.add(n);
    }
    return set;
  });

  private readonly mineCompletedSet = computed(
    () => new Set<number>(this.me()?.studyCompletedSurahs ?? [])
  );

  readonly completedCount = computed(() => this.completedSet().size);
  readonly mineCompletedCount = computed(() => this.mineCompletedSet().size);

  /** Sourate en cours -> les membres dessus (« en cours » prime sur « terminée »). */
  private readonly inProgress = computed(() => {
    const meId = this.currentUserId();
    const map = new Map<number, Lane[]>();
    for (const u of this.users()) {
      const n = u.studySurah;
      if (!n) continue;
      const ayahs = this.ayahsByNumber.get(n) ?? 0;
      const verse = u.studyVerse ?? 0;
      const claim = u.studyClaimSurah === n ? Math.max(0, u.studyClaimVerse ?? 0) : 0;
      const pct = ayahs > 0 ? Math.round((verse / ayahs) * 100) : 0;
      // Le badge se pose au bout de ce qui est annoncé : c'est là qu'en est la personne.
      const claimPct = ayahs > 0 ? Math.round((Math.max(verse, claim) / ayahs) * 100) : 0;
      const lane: Lane = {
        badge: this.badgesByUserId()[u.id] || '?',
        verse,
        claim: claim > verse ? claim : 0,
        pct,
        claimPct,
        mine: u.id === meId,
        riderLeft: `clamp(9px, ${claimPct}%, calc(100% - 9px))`
      };
      const list = map.get(n);
      if (list) list.push(lane); else map.set(n, [lane]);
    }
    return map;
  });

  /**
   * Dernière activité connue sur une sourate, tous membres confondus : c'est ce
   * qui met « la sourate d'hier soir » en haut de la pile. Le champ n'existe que
   * depuis cette version — sans lui, l'ordre retombe sur le numéro de sourate.
   */
  private readonly touchedAt = computed(() => {
    const map = new Map<number, number>();
    for (const u of this.users()) {
      for (const [key, at] of Object.entries(u.studyTouchedAt ?? {})) {
        const n = Number(key);
        if (!Number.isFinite(at)) continue;
        if ((map.get(n) ?? 0) < at) map.set(n, at);
      }
    }
    return map;
  });

  readonly segments = computed<Seg[]>(() => {
    const completed = this.completedSet();
    const mineDone = this.mineCompletedSet();
    const prog = this.inProgress();
    return SURAHS.map(s => {
      const members = prog.get(s.number);
      const kind: Seg['kind'] = members ? 'prog' : completed.has(s.number) ? 'done' : 'free';
      return {
        number: s.number,
        flex: `${s.ayahs} 1 ${Math.max(3, Math.round(s.ayahs * 0.22))}px`,
        title: `${s.number}. ${s.nameFr} — ${s.ayahs} v.`,
        kind,
        mine: members ? members.some(m => m.mine) : mineDone.has(s.number)
      };
    });
  });

  /** Les sourates en cours, la dernière touchée en premier. */
  readonly activeCards = computed<ActiveCard[]>(() => {
    const prog = this.inProgress();
    const touched = this.touchedAt();
    const myProgress = this.me()?.studyProgress ?? {};
    const cards: ActiveCard[] = [];

    for (const s of SURAHS) {
      const members = prog.get(s.number);
      if (!members || !this.matches(s.number, s.nameFr)) continue;

      const lanes = [...members].sort((a, b) => (b.claim || b.verse) - (a.claim || a.verse));
      const mine = lanes.some(l => l.mine);
      const myVerse = myProgress[String(s.number)] ?? 0;
      const pending = members.reduce((n, l) => n + (l.claim > l.verse ? l.claim - l.verse : 0), 0);
      cards.push({
        number: s.number,
        nameFr: s.nameFr,
        nameAr: s.nameAr,
        ayahs: s.ayahs,
        meta: [
          `${s.ayahs} versets`,
          members.length > 1 ? (mine ? `vous êtes ${members.length}` : `${members.length} personnes`) : '',
          pending > 0 ? `${pending} en attente` : ''
        ].filter(Boolean).join(' · '),
        lanes: lanes.slice(0, 4),
        extra: Math.max(0, lanes.length - 4),
        mine,
        action: mine ? 'Continuer' : 'Rejoindre',
        hint: !mine && myVerse > 0 ? `tu en es au verset ${myVerse}` : '',
        pending
      });
    }

    return cards.sort((a, b) => (touched.get(b.number) ?? 0) - (touched.get(a.number) ?? 0) || a.number - b.number);
  });

  readonly activeSummary = computed(() => {
    const cards = this.activeCards();
    const people = cards.reduce((n, c) => n + c.lanes.length + c.extra, 0);
    const s = cards.length > 1 ? 's' : '';
    return `${cards.length} sourate${s} · ${people} personne${people > 1 ? 's' : ''}`;
  });

  /** Suis-je le relecteur de ce salon ? */
  readonly isValidator = computed(() => {
    const v = this.validatorId();
    return !!v && v === this.currentUserId();
  });

  /** Le badge du relecteur, pour dire à qui on annonce. */
  readonly validatorBadge = computed(() => {
    const v = this.validatorId();
    return v ? this.badgesByUserId()[v] || '?' : '';
  });

  /** Les annonces à relire, la plus vieille en haut : c'est elle qui presse. */
  readonly claimRows = computed<ClaimRow[]>(() => {
    if (!this.isValidator()) return [];
    const now = Date.now();
    const rows: ClaimRow[] = [];
    for (const u of this.users()) {
      const surah = u.studyClaimSurah;
      const to = u.studyClaimVerse ?? 0;
      if (!surah || to <= 0) continue;
      const from = (u.studyVerse ?? 0) + 1;
      if (to < from) continue;
      const ayahs = this.ayahsByNumber.get(surah) ?? 0;
      rows.push({
        userId: u.id,
        badge: this.badgesByUserId()[u.id] || '?',
        surah,
        nameFr: this.nameByNumber.get(surah) ?? '',
        ayahs,
        from,
        to,
        age: this.ageLabel(now - (u.studyClaimAt ?? now)),
        finishes: ayahs > 0 && to >= ayahs
      });
    }
    return rows.sort((a, b) => a.surah - b.surah);
  });

  private ageLabel(ms: number): string {
    const days = Math.floor(ms / 86400000);
    if (days >= 2) return `il y a ${days} jours`;
    if (days === 1) return 'hier';
    const hours = Math.floor(ms / 3600000);
    if (hours >= 1) return `il y a ${hours} h`;
    return "à l'instant";
  }

  readonly doneRows = computed<DoneRow[]>(() => {
    const prog = this.inProgress();
    const mineDone = this.mineCompletedSet();
    const finishers = new Map<number, string[]>();
    for (const u of this.users()) {
      for (const n of u.studyCompletedSurahs ?? []) {
        const badge = this.badgesByUserId()[u.id] || '?';
        const list = finishers.get(n);
        if (list) list.push(badge); else finishers.set(n, [badge]);
      }
    }

    return SURAHS
      .filter(s => finishers.has(s.number) && !prog.has(s.number) && this.matches(s.number, s.nameFr))
      .map(s => {
        const badges = finishers.get(s.number)!;
        return {
          number: s.number,
          nameFr: s.nameFr,
          badges: badges.slice(0, 4),
          extra: Math.max(0, badges.length - 4),
          mine: mineDone.has(s.number)
        };
      });
  });

  readonly freeRows = computed<FreeRow[]>(() => {
    const prog = this.inProgress();
    const completed = this.completedSet();
    const myProgress = this.me()?.studyProgress ?? {};
    return SURAHS
      .filter(s => !prog.has(s.number) && !completed.has(s.number) && this.matches(s.number, s.nameFr))
      .map(s => ({
        number: s.number,
        nameFr: s.nameFr,
        nameAr: s.nameAr,
        ayahs: s.ayahs,
        myVerse: myProgress[String(s.number)] ?? 0
      }));
  });

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  clearQuery(): void {
    this.query.set('');
  }

  /** Toucher un segment de la bande amène à la sourate dans la liste. */
  jumpTo(number: number): void {
    this.query.set('');
    this.doneOpen.set(true);
    setTimeout(() => {
      document.getElementById(`s${number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /**
   * Recherche par numéro ou par nom, accents et casse ignorés — « imran »
   * doit trouver Āl-ʿImrān.
   */
  private matches(number: number, nameFr: string): boolean {
    const q = this.query().trim();
    if (!q) return true;
    if (/^\d+$/.test(q)) return String(number).startsWith(q);
    return this.fold(nameFr).includes(this.fold(q));
  }

  private fold(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f\u02bf\u02bc'\u2019-]/g, '').toLowerCase();
  }
}
