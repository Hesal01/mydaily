import { Component, input } from '@angular/core';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-quran-progress',
  standalone: true,
  template: `
    <div class="quran-progress">
      <div class="title">Progression lecture</div>
      <div class="users-list">
        @for (user of users(); track user.id; let i = $index) {
          <div class="user-row" [class.mine]="user.id === currentUserId()">
            <span class="animal">{{ animals()[i] || '?' }}</span>
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
      color: #1f2328;
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
      border-bottom: 1px solid #f0f0f0;
      opacity: 0.65;
    }
    .user-row:last-child {
      border-bottom: none;
    }
    .user-row.mine {
      opacity: 1;
    }
    .animal {
      font-size: 22px;
      flex-shrink: 0;
      width: 30px;
      text-align: center;
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
      background: #2da44e;
    }
    .bar-bg {
      height: 28px;
      background: #ebedf0;
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    }
    .bar-fill {
      height: 100%;
      background: #2da44e;
      border-radius: 6px;
      transition: width 0.3s ease;
    }
    .pct {
      font-size: 12px;
      font-weight: 600;
      color: #656d76;
      flex-shrink: 0;
      min-width: 38px;
      text-align: right;
    }
  `]
})
export class QuranProgressComponent {
  readonly users = input.required<User[]>();
  readonly animals = input.required<string[]>();
  readonly currentUserId = input.required<string | null>();

  getPercentage(page: number): number {
    return Math.round((page / 604) * 100);
  }

  getCycleDots(cycle: number): number[] {
    return Array.from({ length: cycle }, (_, i) => i);
  }
}
