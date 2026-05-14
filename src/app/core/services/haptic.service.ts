import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HapticService {
  private get supported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  tap(): void {
    if (this.supported) navigator.vibrate(8);
  }

  success(): void {
    if (this.supported) navigator.vibrate([5, 30, 12]);
  }

  error(): void {
    if (this.supported) navigator.vibrate([20, 40, 20]);
  }
}
