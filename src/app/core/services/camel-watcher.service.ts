import { Injectable, inject } from '@angular/core';
import { Firestore, doc, onSnapshot } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

const CAMEL_USER_ID = 'user_9';

@Injectable({ providedIn: 'root' })
export class CamelWatcherService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  private unsubscribe: (() => void) | null = null;
  private firstSnapshot = true;
  private prevHadFirstConnected = false;

  start(): void {
    if (this.unsubscribe) return;
    const ref = doc(this.firestore, 'users', CAMEL_USER_ID);
    this.unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.data();
      const hasNow = !!data?.['firstConnectedAt'];
      if (this.firstSnapshot) {
        this.prevHadFirstConnected = hasNow;
        this.firstSnapshot = false;
        return;
      }
      if (!this.prevHadFirstConnected && hasNow) {
        this.notify();
      }
      this.prevHadFirstConnected = hasNow;
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.firstSnapshot = true;
  }

  private notify(): void {
    if (this.auth.userId() === CAMEL_USER_ID) return;

    const title = '🐫 Le chameau est arrivé !';
    const body = 'Premier login du chameau — bienvenue à bord.';

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/icons/icon-192x192.png' });
      } catch (e) {
        console.log('Notification API failed, fallback to toast', e);
      }
    }

    this.toast.show(`${title} ${body}`, { durationMs: 5000 });
  }
}
