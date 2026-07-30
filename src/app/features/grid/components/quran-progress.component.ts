import { Component, input } from '@angular/core';
import { User } from '../../../core/models/user.model';
import { isInitialsBadge } from '../../../core/constants/habits.constants';

@Component({
  selector: 'app-quran-progress',
  standalone: true,
  template: `
    <div class="quran-progress">
      <div class="title">Progression lecture</div>
      <div class="users-list">
        @for (user of users(); track user.id) {
          <div class="user-row" [class.mine]="user.id === currentUserId()">
            <span class="badge" [class.initials]="isInitials(badgesByUserId()[user.id])">{{ badgesByUserId()[user.id] || '?' }}</span>
            <div class="bar-wrapper">
              @if ((user.quranCycle || 0) > 0) {
                <div class="cycle-dots">
                  @for (dot of getCycleDots(user.quranCycle || 0); track dot) {
                    <span class="cycle-dot"></span>
                  }
                </div>
              }
              <div class="bar-bg">
                <div class="bar-fill" [style.width.%]="getPercentage(user.quranPage || 0)"></div>
              </div>
            </div>
            <span class="pct">p.{{ user.quranPage || 0 }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .quran-progress {
      padding: 8px 0;
    }
    .title {
      font-size: 17px;
      font-weight: 600;
      text-align: center;
      color: var(--color-text);
      margin-bottom: 20px;
    }
    .users-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .user-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 0;
      border-bottom: 1px solid var(--color-surface-1);
      opacity: 0.65;
    }
    .user-row:last-child {
      border-bottom: none;
    }
    .user-row.mine {
      opacity: 1;
    }
    .badge {
      font-size: 22px;
      line-height: 1;
      flex-shrink: 0;
      width: 30px;
      text-align: center;
      color: var(--color-text);
    }
    .badge.initials {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .user-row.mine .badge {
      color: var(--color-success-dark);
    }
    .bar-wrapper {
      flex: 1;
      min-width: 0;
    }
    .cycle-dots {
      display: flex;
      gap: 4px;
      margin-bottom: 3px;
    }
    .cycle-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-success);
    }
    .bar-bg {
      height: 28px;
      background: var(--color-surface-2);
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    }
    .bar-fill {
      height: 100%;
      background: var(--color-success);
      border-radius: 6px;
      transition: width var(--duration-slow) var(--ease-out);
    }
    .pct {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-muted);
      flex-shrink: 0;
      min-width: 38px;
      text-align: right;
    }
  `]
})
export class QuranProgressComponent {
  readonly users = input.required<User[]>();
  readonly badgesByUserId = input.required<Record<string, string>>();
  readonly currentUserId = input.required<string | null>();
  readonly isInitials = isInitialsBadge;

  getPercentage(page: number): number {
    return Math.round((page / 604) * 100);
  }

  getCycleDots(cycle: number): number[] {
    return Array.from({ length: cycle }, (_, i) => i);
  }
}
