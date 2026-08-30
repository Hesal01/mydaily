import { Injectable, inject, signal } from '@angular/core';
import { Firestore, doc, setDoc, arrayUnion } from '@angular/fire/firestore';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { environment } from '../../../environments/environment';
import { ToastService } from './toast.service';

export type NotificationStatus = 'ready' | 'ios-needs-install' | 'not-supported' | 'denied' | 'pending';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private toast = inject(ToastService);
  private messaging: Messaging | null = null;
  private messageListenerActive = false;

  readonly status = signal<NotificationStatus>('pending');
  readonly isIOS = signal(false);
  readonly isStandalone = signal(false);
  /** Bannière d'aide refermée pour cette session ; elle revient à la prochaine
   *  visite tant que les notifs ne sont pas actives. */
  readonly bannerDismissed = signal(false);

  constructor() {
    this.detectPlatform();
  }

  private detectPlatform(): void {
    if (typeof window === 'undefined') return;

    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const navigatorStandalone = (window.navigator as any).standalone;
    const isStandalone = displayModeStandalone || navigatorStandalone === true;

    this.isIOS.set(isIOS);
    this.isStandalone.set(isStandalone);
  }

  private getMessagingInstance(): Messaging | null {
    if (this.messaging) return this.messaging;

    try {
      const app = getApp();
      this.messaging = getMessaging(app);
      return this.messaging;
    } catch (error) {
      console.log('Firebase Messaging not available:', error);
      return null;
    }
  }

  /**
   * Au chargement : ne demande jamais la permission — sans geste utilisateur,
   * les navigateurs ignorent ou refusent la demande en silence. Si elle est
   * déjà accordée, rafraîchit le token ; sinon pose juste le statut pour que
   * la grille propose l'activation manuelle (puce + bannière).
   */
  async syncStatus(userId: string): Promise<void> {
    const blocked = this.blockedStatus();
    if (blocked) {
      this.status.set(blocked);
      return;
    }
    if (Notification.permission === 'granted') {
      await this.saveToken(userId);
      this.listenForMessages();
      return;
    }
    this.status.set(Notification.permission === 'denied' ? 'denied' : 'pending');
  }

  /**
   * Activation manuelle, à appeler depuis un geste utilisateur (la demande de
   * permission n'aboutit que là). Gère aussi le retour visible : toast de
   * confirmation ou d'explication, et réaffichage de la bannière d'aide quand
   * il faut d'abord installer l'app.
   */
  async activate(userId: string): Promise<void> {
    const blocked = this.blockedStatus();
    if (blocked) {
      this.status.set(blocked);
      this.bannerDismissed.set(false);
      if (blocked === 'not-supported') {
        this.toast.show('Ce navigateur ne permet pas les notifications', { icon: 'bell-slash', durationMs: 4000 });
      }
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.status.set('denied');
        this.toast.show('Notifications bloquées — autorise-les dans les réglages du navigateur', {
          icon: 'bell-slash',
          durationMs: 5000
        });
        return;
      }
      await this.saveToken(userId);
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      this.status.set('not-supported');
    }

    if (this.status() === 'ready') {
      this.listenForMessages();
      this.toast.show('Notifications activées', { icon: 'bell-ringing', iconColor: 'var(--color-success)' });
    } else {
      this.toast.show("L'activation a échoué, réessaie plus tard", { icon: 'bell-slash', durationMs: 4000 });
    }
  }

  /**
   * Ce qui rend toute demande de permission vaine ici : API absente, ou iOS
   * hors PWA — Safari n'expose les notifs qu'une fois l'app ajoutée à l'écran
   * d'accueil et ouverte depuis son icône.
   */
  private blockedStatus(): NotificationStatus | null {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return this.isIOS() && !this.isStandalone() ? 'ios-needs-install' : 'not-supported';
    }
    if (this.isIOS() && !this.isStandalone()) {
      return 'ios-needs-install';
    }
    return null;
  }

  /** Enregistre le service worker, récupère le token FCM et le stocke sur le doc user. */
  private async saveToken(userId: string): Promise<void> {
    try {
      const messaging = this.getMessagingInstance();
      if (!messaging) {
        this.status.set('not-supported');
        return;
      }

      let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (!registration) {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      }

      if (registration.installing || registration.waiting) {
        await new Promise<void>((resolve) => {
          const sw = registration!.installing || registration!.waiting;
          if (!sw) {
            resolve();
            return;
          }
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') {
              resolve();
            }
          });
        });
      }

      const token = await getToken(messaging, {
        vapidKey: environment.firebase.vapidKey,
        serviceWorkerRegistration: registration
      });

      if (!token) {
        this.status.set('not-supported');
        return;
      }

      // Un appareil = un token. `fcmTokens` les garde tous pour que le
      // téléphone et l'ordi soient prévenus tous les deux ; `fcmToken` reste
      // écrit pour les sessions qui n'ont pas encore rechargé le nouveau code.
      // Les entrées mortes sont retirées à l'envoi, côté Cloud Function.
      const userRef = doc(this.firestore, 'users', userId);
      await setDoc(userRef, { fcmToken: token, fcmTokens: arrayUnion(token) }, { merge: true });
      console.log('FCM token saved for', userId);
      this.status.set('ready');
    } catch (error) {
      console.error('Error saving FCM token:', error);
      this.status.set('not-supported');
    }
  }

  /**
   * Affiche la notif quand l'app est au premier plan : le service worker s'en
   * abstient dès qu'un onglet est visible, c'est donc à la page de le faire.
   *
   * Sur mobile le constructeur `Notification` n'existe pas dans la page : ni
   * Chrome sur Android (« Illegal constructor. Use
   * ServiceWorkerRegistration.showNotification() instead. ») ni WebKit sur iOS
   * ne l'exposent ailleurs que dans le service worker. L'appeler y levait une
   * exception avalée par onMessage : app ouverte = notif perdue en silence, et
   * rien ne le signalait. On passe donc par le registration, seule voie commune
   * à tous, en gardant le constructeur en secours pour les navigateurs de
   * bureau.
   */
  private async showForeground(title: string, body?: string): Promise<void> {
    const options: NotificationOptions = { body, icon: '/icons/icon-192x192.png' };
    try {
      const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (registration) {
        await registration.showNotification(title, options);
        return;
      }
      new Notification(title, options);
    } catch (error) {
      console.error('Error showing foreground notification:', error);
    }
  }

  dismissBanner(): void {
    this.bannerDismissed.set(true);
  }

  listenForMessages(): void {
    if (this.messageListenerActive) return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const messaging = this.getMessagingInstance();
    if (!messaging) return;

    try {
      onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);

        // Congrats are celebrated in-app via the Firestore listener (live
        // confetti). Skip the redundant system banner when the app is open.
        if (payload.data && payload.data['type'] === 'congrats') {
          return;
        }

        if (payload.notification) {
          void this.showForeground(
            payload.notification.title || 'MyDaily',
            payload.notification.body
          );
        }
      });
      this.messageListenerActive = true;
    } catch (error) {
      console.error('Error setting up message listener:', error);
    }
  }
}
