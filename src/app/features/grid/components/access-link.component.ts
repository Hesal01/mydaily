import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Le lien d'accès de la personne, et la seule façon de revenir dans l'app si le
 * navigateur oublie la session — ce qu'il fait au bout d'environ sept jours sans
 * visite, en effaçant localStorage et le Cache Storage d'un coup. Sans ce lien
 * quelque part, il ne reste que l'écran de saisie du token et personne ne
 * connaît son token par cœur.
 *
 * Copier ou partager remonte à `saved` : c'est noté sur le doc user, pour que
 * l'app sache, même après un effacement, que la personne a de quoi revenir.
 */
@Component({
  selector: 'app-access-link',
  standalone: true,
  template: `
    <div class="backdrop" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-title">Ton lien d'accès</div>

        <p class="explain">
          Il te reconnecte si l'app t'oublie — ça arrive après une semaine sans
          l'ouvrir. Garde-le quelque part : tes notes, ou un message à toi-même.
        </p>

        <div class="link-box" (click)="copy()">{{ url() }}</div>

        <div class="actions">
          <button class="btn primary" (click)="copy()">
            <i class="ph ph-copy"></i>
            <span>Copier</span>
          </button>
          @if (canShare()) {
            <button class="btn primary" (click)="share()">
              <i class="ph ph-share-network"></i>
              <span>Partager</span>
            </button>
          }
        </div>

        <p class="warn">
          <i class="ph ph-warning"></i>
          <span>Ce lien ouvre ton compte : ne le publie pas dans un groupe.</span>
        </p>

        <div class="modal-actions">
          <button class="btn-close" (click)="close.emit()">Fermer</button>
        </div>
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
      padding: 20px;
    }
    .modal {
      background: var(--color-bg);
      border-radius: var(--radius-md);
      padding: 20px;
      width: 100%;
      max-width: 380px;
      box-shadow: var(--shadow-lifted);
    }
    .modal-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--color-text);
      margin-bottom: 8px;
    }
    .explain {
      font-size: 13px;
      line-height: 1.5;
      color: var(--color-text-muted);
      margin: 0 0 14px;
    }
    .link-box {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 1.5;
      word-break: break-all;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      color: var(--color-text);
      cursor: pointer;
      user-select: all;
      -webkit-user-select: all;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 11px 12px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
    }
    .btn.primary {
      background: var(--color-success);
      color: white;
    }
    .btn i {
      font-size: 17px;
    }
    .warn {
      display: flex;
      gap: 7px;
      align-items: flex-start;
      font-size: 12px;
      line-height: 1.45;
      color: var(--color-text-muted);
      margin: 14px 0 0;
    }
    .warn i {
      flex-shrink: 0;
      margin-top: 1px;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
    .btn-close {
      padding: 9px 18px;
      font-size: 14px;
      background: var(--color-surface-2);
      color: var(--color-text);
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
    }
  `]
})
export class AccessLinkComponent {
  private toast = inject(ToastService);

  readonly token = input.required<string>();
  readonly close = output<void>();
  /** Émis dès que le lien est réellement sorti de l'app (copié ou partagé). */
  readonly saved = output<void>();

  readonly url = computed(() => `${location.origin}/?token=${this.token()}`);
  readonly canShare = signal(typeof navigator !== 'undefined' && !!navigator.share);

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.saved.emit();
      this.toast.show('Lien copié', { icon: 'check-circle', iconColor: 'var(--color-success)' });
    } catch (error) {
      console.error('Copy failed:', error);
      // Pas de presse-papiers (contexte non sécurisé, navigateur ancien) : le
      // lien est sélectionnable dans la boîte, on renvoie vers lui.
      this.toast.show('Appuie longuement sur le lien pour le copier', { durationMs: 4000 });
    }
  }

  async share(): Promise<void> {
    try {
      await navigator.share({ title: 'Mon lien MyDaily', url: this.url() });
      this.saved.emit();
    } catch (error) {
      // Annuler le partage passe par une exception : ce n'est pas une erreur.
      if ((error as DOMException)?.name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  }
}
