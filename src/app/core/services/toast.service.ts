import { Injectable, signal } from '@angular/core';

export interface ToastAction {
  label: string;
  handler: () => void | Promise<void>;
}

export interface Toast {
  id: number;
  message: string;
  icon?: string;
  iconColor?: string;
  action?: ToastAction;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly current = signal<Toast | null>(null);
  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(
    message: string,
    options: { action?: ToastAction; icon?: string; iconColor?: string; durationMs?: number } = {}
  ): void {
    if (this.timer) clearTimeout(this.timer);
    const toast: Toast = {
      id: this.nextId++,
      message,
      icon: options.icon,
      iconColor: options.iconColor,
      action: options.action,
    };
    this.current.set(toast);
    this.timer = setTimeout(() => this.dismiss(toast.id), options.durationMs ?? 2500);
  }

  dismiss(id?: number): void {
    if (id != null && this.current()?.id !== id) return;
    this.current.set(null);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async runAction(): Promise<void> {
    const toast = this.current();
    if (!toast?.action) return;
    const handler = toast.action.handler;
    this.dismiss(toast.id);
    await handler();
  }
}
