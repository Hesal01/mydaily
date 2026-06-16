import { Component, input, inject, signal } from '@angular/core';
import { User } from '../../../core/models/user.model';
import { HabitService } from '../../../core/services/habit.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <div class="wrap">
      <div class="card">
        <div class="card-title">Confidentialité</div>

        <div class="toggle-row">
          <div class="toggle-text">
            <div class="toggle-label">Mode privé</div>
            <div class="toggle-desc">
              Cache ton activité aux autres et masque la leur pour toi.
            </div>
          </div>
          <button
            class="switch"
            type="button"
            role="switch"
            [attr.aria-checked]="enabled()"
            [class.on]="enabled()"
            [disabled]="saving()"
            (click)="toggle()"
          >
            <span class="knob"></span>
          </button>
        </div>

        <div class="info">
          <i class="ph ph-info"></i>
          <span>
            @if (enabled()) {
              Tu es invisible des autres et tu ne vois qu'eux<strong>-même</strong>.
              Tes écrans <strong>Aperçu</strong> et <strong>Année</strong> restent disponibles.
            } @else {
              Tu vois actuellement <strong>{{ visibleUsersCount() - 1 }}</strong>
              autre{{ visibleUsersCount() - 1 > 1 ? 's' : '' }}
              personne{{ visibleUsersCount() - 1 > 1 ? 's' : '' }}
              sur <strong>{{ totalUsersCount() - 1 }}</strong>.
            }
          </span>
        </div>
      </div>

      <div class="card sub">
        <div class="card-title">Ce qui est concerné</div>
        <ul class="list">
          <li><i class="ph ph-grid-four"></i> Grille des habitudes</li>
          <li><i class="ph ph-book-open"></i> Progression Coran</li>
          <li><i class="ph ph-trophy"></i> Classements</li>
        </ul>
        <div class="card-title sub-title">Toujours visibles pour toi</div>
        <ul class="list muted">
          <li><i class="ph ph-chart-line"></i> Aperçu personnel</li>
          <li><i class="ph ph-calendar"></i> Heatmap année</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .wrap {
      padding: 12px 16px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card {
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 14px;
      box-shadow: var(--shadow-card);
    }
    .card-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 12px;
    }
    .sub-title {
      margin-top: 14px;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 0 12px;
    }
    .toggle-text {
      flex: 1;
      min-width: 0;
    }
    .toggle-label {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text);
    }
    .toggle-desc {
      font-size: 13px;
      color: var(--color-text-muted);
      margin-top: 2px;
    }
    .switch {
      flex-shrink: 0;
      width: 50px;
      height: 30px;
      border-radius: 999px;
      border: none;
      background: var(--color-surface-2);
      position: relative;
      cursor: pointer;
      transition: background var(--duration-fast) var(--ease-out);
      padding: 0;
    }
    .switch.on {
      background: var(--color-success);
    }
    .switch:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      transition: transform var(--duration-fast) var(--ease-out);
    }
    .switch.on .knob {
      transform: translateX(20px);
    }
    .info {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 10px 12px;
      background: var(--color-surface-1);
      border-radius: var(--radius-sm, 8px);
      font-size: 13px;
      color: var(--color-text);
      line-height: 1.45;
    }
    .info i {
      flex-shrink: 0;
      margin-top: 2px;
      color: var(--color-text-muted);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .list li {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: var(--color-text);
    }
    .list li i {
      color: var(--color-text-muted);
      font-size: 18px;
    }
    .list.muted li {
      color: var(--color-text-muted);
    }
  `]
})
export class SettingsComponent {
  private habitService = inject(HabitService);

  readonly currentUser = input.required<User | null>();
  readonly visibleUsersCount = input.required<number>();
  readonly totalUsersCount = input.required<number>();

  readonly saving = signal(false);

  enabled(): boolean {
    return !!this.currentUser()?.privacyMode;
  }

  async toggle(): Promise<void> {
    const user = this.currentUser();
    if (!user || this.saving()) return;
    this.saving.set(true);
    try {
      await this.habitService.setPrivacyMode(user.id, !user.privacyMode);
    } finally {
      this.saving.set(false);
    }
  }
}
