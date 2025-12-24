import { Injectable, inject, signal } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { environment } from '../../../environments/environment';

export type NotificationStatus = 'ready' | 'ios-needs-install' | 'not-supported' | 'denied' | 'pending';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private messaging: Messaging | null = null;
  private messageListenerActive = false;

  readonly status = signal<NotificationStatus>('pending');
  readonly isIOS = signal(false);
  readonly isStandalone = signal(false);

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

    console.log('Platform detection:', {
      userAgent,
      isIOS,
      displayModeStandalone,
      navigatorStandalone,
      isStandalone
    });

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

  async requestPermissionAndSaveToken(userId: string): Promise<void> {
    // Check if Notification API is supported
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('Notifications not supported');
      this.status.set('not-supported');
      return;
    }

    // iOS specific handling - temporarily disabled for debugging
    // if (this.isIOS()) {
    //   if (!this.isStandalone()) {
    //     console.log('iOS: App needs to be installed to home screen');
    //     this.status.set('ios-needs-install');
    //     return;
    //   }
    // }

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        console.log('Notification permission granted');
        this.status.set('ready');

        const messaging = this.getMessagingInstance();
        if (!messaging) {
          console.log('Messaging not available');
          return;
        }

        // Register service worker
        let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!registration) {
          registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        }
        console.log('Service worker registered');

        // Wait for service worker to be active
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
        console.log('Service worker active');

        // Get FCM token
        const token = await getToken(messaging, {
          vapidKey: environment.firebase.vapidKey,
          serviceWorkerRegistration: registration
        });

        if (token) {
          console.log('FCM Token:', token);

          // Save token to Firestore
          const userRef = doc(this.firestore, 'users', userId);
          await setDoc(userRef, { fcmToken: token }, { merge: true });
          console.log('Token saved to Firestore');
        }
      } else {
        console.log('Notification permission denied');
        this.status.set('denied');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      this.status.set('not-supported');
    }
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

        if (payload.notification) {
          new Notification(payload.notification.title || 'MyDaily', {
            body: payload.notification.body,
            icon: '/icons/icon-192x192.png'
          });
        }
      });
      this.messageListenerActive = true;
    } catch (error) {
      console.error('Error setting up message listener:', error);
    }
  }
}
