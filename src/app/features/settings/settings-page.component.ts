import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { HabitService } from '../../core/services/habit.service';
import { NotificationService } from '../../core/services/notification.service';
import { HapticService } from '../../core/services/haptic.service';
import { SalonService } from '../../core/services/salon.service';
import { USER_ICONS, isInitialsBadge } from '../../core/constants/habits.constants';
import { SettingsComponent } from '../grid/components/settings.component';
import { AccessLinkComponent } from '../grid/components/access-link.component';
import { ToastComponent } from '../../shared/components/toast.component';

/**
 * Les réglages, sortis de la barre du haut.
 *
 * Chaque option y arrivait sous forme de puce, et la barre finissait par porter
 * plus de sollicitations que de contenu — une cloche qui proposait d'activer ce
 * qui l'était déjà, une clé qu'un seul membre sur neuf a remarquée. Une page les
 * rassemble sans encombrer la grille, et laisse de la place pour ce qui viendra.
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [SettingsComponent, AccessLinkComponent, ToastComponent],
  template: `
    <div class="page">
      <header class="topbar">
        <button class="back" (click)="goBack()" aria-label="Retour">
          <i class="ph ph-caret-left"></i>
        </button>
        <h1>Réglages</h1>
      </header>

      <div class="wrap">
        <div class="card">
          <div class="card-title">Ton lien d'accès</div>
          <p class="card-desc">
            Il te reconnecte si l'app t'oublie — ça arrive après une semaine sans
            l'ouvrir. Garde-le hors du navigateur : tes notes, ou un message à
            toi-même.
          </p>
          @if (myToken()) {
            <button class="btn" [class.primary]="!linkSaved()" (click)="openAccessLink()">
              <i class="ph ph-key"></i>
              <span>{{ linkSaved() ? 'Revoir mon lien' : 'Garder mon lien' }}</span>
            </button>
            @if (!linkSaved()) {
              <p class="warn">
                <i class="ph ph-warning"></i>
                <span>Tu ne l'as encore rangé nulle part.</span>
              </p>
            }
          }
        </div>

        <div class="card">
          <div class="card-title">Notifications</div>
          <p class="card-desc">{{ notifDesc() }}</p>
          @if (notifStatus() === 'pending' || notifStatus() === 'denied') {
            <button class="btn primary" (click)="activateNotifs()">
              <i class="ph ph-bell"></i>
              <span>Activer les notifications</span>
            </button>
          }
        </div>
        @if (showValidatorCard()) {
          <div class="card">
            <div class="card-title">Qui relit l'étude</div>
            <p class="card-desc">
              La personne choisie entend les versets avant qu'ils comptent. Chez les autres,
              ce qui est annoncé reste hachuré jusqu'à son feu vert — et une sourate ne
              rejoint le compte de la famille qu'une fois entendue.
            </p>
            <div class="picker">
              <button class="pick" [class.on]="!validatorId()" (click)="chooseValidator(null)">
                <span class="pb none">—</span>
                <span class="pn">Personne</span>
                @if (!validatorId()) { <i class="ph ph-check"></i> }
              </button>
              @for (u of users(); track u.id) {
                <button class="pick" [class.on]="validatorId() === u.id" (click)="chooseValidator(u.id)">
                  <span class="pb" [class.initials]="isInitials(badgeOf(u.id))">{{ badgeOf(u.id) }}</span>
                  @if (u.id === currentUserId()) { <span class="pn">Toi</span> }
                  @if (validatorId() === u.id) { <i class="ph ph-check"></i> }
                </button>
              }
            </div>
            <p class="card-note">Le changement s'applique tout de suite, pour tout le monde.</p>
          </div>
        }
      </div>

      <app-settings
        [currentUser]="currentUser()"
        [visibleUsersCount]="visibleUsersCount()"
        [totalUsersCount]="totalUsersCount()"
      />

      @if (showAccessLink() && myToken()) {
        <app-access-link
          [token]="myToken()!"
          (saved)="onAccessLinkSaved()"
          (close)="showAccessLink.set(false)"
        />
      }

      <app-toast />
    </div>
  `,
  styles: [`
    .picker {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--color-border);
      border-radius: 12px;
      overflow: hidden;
      margin-top: 12px;
    }
    .pick {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      min-height: 44px;
      border: none;
      border-bottom: 1px solid var(--color-surface-2);
      background: var(--color-bg);
      color: var(--color-text);
      font-family: inherit;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      touch-action: manipulation;
    }
    .pick:last-child { border-bottom: none; }
    .pick.on { background: var(--color-success-soft); font-weight: 600; }
    .pick i { margin-left: auto; color: var(--color-success); }
    .pb {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--color-surface-1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
    }
    .pb.initials { font-size: 11px; font-weight: 700; }
    .pb.none { color: var(--color-text-muted); }
    .pn { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-note {
      margin: 10px 0 0;
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .page {
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--color-bg-subtle, #f6f8fa);
      padding-bottom: max(24px, env(safe-area-inset-bottom));
    }
    .topbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 12px 16px;
      padding-top: max(12px, env(safe-area-inset-top));
      position: sticky;
      top: 0;
      background: var(--color-bg-subtle, #f6f8fa);
      z-index: 10;
    }
    .topbar h1 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: var(--color-text);
    }
    .back {
      background: transparent;
      border: none;
      color: var(--color-text);
      font-size: 24px;
      line-height: 1;
      padding: 4px 8px 4px 0;
      cursor: pointer;
      touch-action: manipulation;
    }
    .back:active { transform: scale(0.92); }
    .wrap {
      padding: 0 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card {
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 14px;
    }
    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 6px;
    }
    .card-desc {
      margin: 0 0 12px 0;
      font-size: 13px;
      line-height: 1.45;
      color: var(--color-text-muted);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 16px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--color-border);
      background: var(--color-bg);
      color: var(--color-text);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      touch-action: manipulation;
    }
    .btn.primary {
      background: var(--color-success);
      border-color: var(--color-success);
      color: white;
    }
    .btn:active { transform: scale(0.96); }
    .warn {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 10px 0 0 0;
      font-size: 12.5px;
      color: var(--color-text-muted);
    }
  `]
})
export class SettingsPageComponent {
  private authService = inject(AuthService);
  private habitService = inject(HabitService);
  private notificationService = inject(NotificationService);
  private hapticService = inject(HapticService);
  private router = inject(Router);

  readonly showAccessLink = signal(false);
  readonly notifStatus = this.notificationService.status;

  private salonService = inject(SalonService);
  readonly currentUserId = this.authService.userId;
  readonly isInitials = isInitialsBadge;
  private readonly salonId$ = toObservable(this.authService.salonId);

  readonly users = toSignal(
    this.salonId$.pipe(switchMap(salonId =>
      salonId ? this.habitService.getAllUsers(salonId, { waitForServer: false }) : of([])
    )),
    { initialValue: [] }
  );

  readonly currentUser = computed(() => {
    const id = this.currentUserId();
    if (!id) return null;
    return this.users().find(u => u.id === id) ?? null;
  });

  readonly myToken = computed(() => this.currentUser()?.token ?? null);
  readonly linkSaved = computed(() => !!this.currentUser()?.linkSavedAt);

  readonly totalUsersCount = computed(() => this.users().length);

  /** Même règle que la grille : en mode privé on ne voit que soi. */
  readonly visibleUsersCount = computed(() => {
    const all = this.users();
    const me = all.find(u => u.id === this.currentUserId());
    if (me?.privacyMode) return 1;
    return all.filter(u => u.id === me?.id || !u.privacyMode).length;
  });

  /** La carte n'a de sens que dans un salon qui suit l'étude. */
  readonly showValidatorCard = computed(() =>
    this.salonService.currentHabits().some(h => h.id === 'study') && this.users().length > 1
  );

  readonly validatorId = computed(() => {
    const salonId = this.authService.salonId();
    if (!salonId) return null;
    return this.users().find(u => u.validatorSalonIds?.includes(salonId))?.id ?? null;
  });

  badgeOf(userId: string): string {
    const users = this.users();
    const index = users.findIndex(u => u.id === userId);
    const u = users[index];
    if (!u) return '?';
    const salonId = this.authService.salonId();
    const perSalon = salonId ? u.labels?.[salonId]?.trim() : '';
    return perSalon || u.label?.trim() || USER_ICONS[u.animalIndex ?? index] || '?';
  }

  async chooseValidator(userId: string | null): Promise<void> {
    const salonId = this.authService.salonId();
    if (!salonId) return;
    const previous = this.validatorId();
    if (previous === userId) return;
    this.hapticService.tap();
    await this.habitService.setStudyValidator(salonId, userId, previous);
  }

  readonly notifDesc = computed(() => {
    switch (this.notifStatus()) {
      case 'ready':
        return 'Activées : tu es prévenu quand le salon avance.';
      case 'denied':
        return 'Bloquées par le navigateur. Il faut les réautoriser dans ses réglages, puis revenir ici.';
      case 'ios-needs-install':
        return "Sur iPhone, les notifications n'existent qu'une fois l'app ajoutée à l'écran d'accueil et rouverte depuis son icône.";
      case 'not-supported':
        return 'Ce navigateur ne sait pas les afficher.';
      default:
        return 'Sois prévenu quand le salon avance.';
    }
  });

  goBack(): void {
    void this.router.navigate(['/grid']);
  }

  openAccessLink(): void {
    if (!this.myToken()) return;
    this.hapticService.tap();
    this.showAccessLink.set(true);
  }

  onAccessLinkSaved(): void {
    const userId = this.currentUserId();
    if (!userId) return;
    void this.habitService.markAccessLinkSaved(userId);
  }

  activateNotifs(): void {
    const userId = this.currentUserId();
    if (!userId) return;
    this.hapticService.tap();
    void this.notificationService.activate(userId);
  }
}
