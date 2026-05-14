import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    @if (toastService.current(); as toast) {
      <div class="toast" [attr.data-id]="toast.id" role="status">
        @if (toast.icon) {
          <i class="ph ph-{{ toast.icon }} icon" [style.color]="toast.iconColor || '#fff'"></i>
        }
        <span class="message">{{ toast.message }}</span>
        @if (toast.action) {
          <button class="action" (click)="onAction()">{{ toast.action.label }}</button>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      position: fixed;
      left: 0;
      right: 0;
      bottom: calc(env(safe-area-inset-bottom) + 96px);
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: 200;
    }
    .toast {
      pointer-events: auto;
      background: var(--color-text);
      color: #fff;
      border-radius: var(--radius-pill);
      padding: 10px 8px 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: var(--shadow-lifted);
      animation: slide-up-fade var(--duration-base) var(--ease-out);
      max-width: 90vw;
      font-size: 14px;
    }
    .icon {
      font-size: 18px;
      line-height: 1;
    }
    .message {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .action {
      background: transparent;
      border: none;
      color: #7ee492;
      font-weight: 700;
      font-size: 14px;
      padding: 4px 12px;
      border-radius: var(--radius-pill);
      cursor: pointer;
      touch-action: manipulation;
      transition: background var(--duration-fast) ease;
    }
    .action:active {
      background: rgba(126, 228, 146, 0.15);
    }
  `]
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  onAction(): void {
    this.toastService.runAction();
  }
}
