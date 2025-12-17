import { Component, inject, signal } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-install-prompt',
  standalone: true,
  template: `
    @if (showPrompt()) {
      <div class="install-prompt">
        <div class="content">
          <div class="icon">📲</div>
          <div class="text">
            <strong>Activer les notifications</strong>
            <p>Ajoute l'app à ton écran d'accueil :</p>
            <ol>
              <li>Appuie sur <span class="share-icon">⬆️</span> (Partager)</li>
              <li>Choisis "Sur l'écran d'accueil"</li>
            </ol>
          </div>
        </div>
        <button class="close-btn" (click)="dismiss()">✕</button>
      </div>
    }
  `,
  styles: [`
    .install-prompt {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #1f2328;
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
    .share-icon {
      display: inline-block;
    }
    .close-btn {
      background: transparent;
      border: none;
      color: white;
      font-size: 20px;
      padding: 4px 8px;
      cursor: pointer;
      opacity: 0.7;
    }
    .close-btn:hover {
      opacity: 1;
    }
  `]
})
export class InstallPromptComponent {
  private notificationService = inject(NotificationService);
  private dismissed = signal(false);

  readonly showPrompt = () => {
    return this.notificationService.status() === 'ios-needs-install' && !this.dismissed();
  };

  dismiss(): void {
    this.dismissed.set(true);
    localStorage.setItem('install-prompt-dismissed', 'true');
  }

  constructor() {
    // Check if already dismissed
    if (localStorage.getItem('install-prompt-dismissed') === 'true') {
      this.dismissed.set(true);
    }
  }
}
