import { Component, computed, inject } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * Bannière d'activation des notifications. Deux situations :
 *   - iOS hors PWA : les notifs n'existent qu'app installée — on explique
 *     l'ajout à l'écran d'accueil ;
 *   - permission jamais demandée : un bouton la demande (la demande doit
 *     partir d'un geste utilisateur, sinon le navigateur l'ignore).
 * Refermable par session seulement : elle revient tant que rien n'est activé.
 */
@Component({
  selector: 'app-notification-prompt',
  standalone: true,
  template: `
    @if (showPrompt()) {
      <div class="notif-prompt">
        <div class="content">
          @if (status() === 'ios-needs-install') {
            <i class="ph ph-device-mobile icon"></i>
            <div class="text">
              <strong>Activer les notifications</strong>
              <p>Ajoute l'app à ton écran d'accueil :</p>
              <ol>
                <li>
                  Appuie sur <i class="ph ph-share inline-icon"></i> (Partager)
                </li>
                <li>Choisis "Sur l'écran d'accueil"</li>
                <li>Rouvre l'app depuis son icône</li>
              </ol>
            </div>
          } @else {
            <i class="ph ph-bell icon"></i>
            <div class="text">
              <strong>Activer les notifications</strong>
              <p>Sois prévenu quand le salon avance.</p>
              <button class="activate-btn" (click)="activate()">Activer</button>
            </div>
          }
        </div>
        <button class="close-btn" (click)="dismiss()" aria-label="Fermer">
          <i class="ph ph-x"></i>
        </button>
      </div>
    }
  `,
  styles: [`
    .notif-prompt {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--color-text);
      color: white;
      padding: 16px;
      padding-bottom: max(16px, env(safe-area-inset-bottom));
      display: flex;
      align-items: flex-start;
      gap: 12px;
      z-index: 1000;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    }
    .content {
      flex: 1;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .icon {
      font-size: 32px;
      line-height: 1;
    }
    .inline-icon {
      font-size: 14px;
      vertical-align: middle;
    }
    .text {
      flex: 1;
    }
    .text strong {
      display: block;
      margin-bottom: 4px;
    }
    .text p {
      margin: 0 0 8px 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .text ol {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
      opacity: 0.85;
    }
    .text li {
      margin-bottom: 4px;
    }
    .activate-btn {
      padding: 8px 20px;
      border-radius: var(--radius-pill);
      border: none;
      background: var(--color-success);
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      touch-action: manipulation;
    }
    .activate-btn:active {
      transform: scale(0.96);
    }
    .close-btn {
      background: transparent;
      border: none;
      color: white;
      font-size: 20px;
      line-height: 1;
      padding: 4px 8px;
      cursor: pointer;
      opacity: 0.7;
    }
    .close-btn:hover {
      opacity: 1;
    }
  `]
})
export class NotificationPromptComponent {
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);

  readonly status = this.notificationService.status;

  readonly showPrompt = computed(() => {
    if (!this.authService.userId()) return false;
    if (this.notificationService.bannerDismissed()) return false;
    const status = this.status();
    return status === 'ios-needs-install' || status === 'pending';
  });

  activate(): void {
    const userId = this.authService.userId();
    if (!userId) return;
    void this.notificationService.activate(userId);
  }

  dismiss(): void {
    this.notificationService.dismissBanner();
  }
}
