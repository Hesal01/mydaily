import { Injectable, inject, signal } from '@angular/core';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { environment } from '../../../environments/environment';

export type NotificationStatus = 'ready' | 'ios-needs-install' | 'not-supported' | 'denied' | 'pending';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private messaging: Messaging | null = null;

  readonly status = signal<NotificationStatus>('pending');
  readonly isIOS = signal(false);
  readonly isStandalone = signal(false);

  constructor() {
    this.detectPlatform();
  }

  private detectPlatform(): void {
    if (typeof window === 'undefined') return;

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    this.isIOS.set(isIOS);

    // Detect standalone mode (PWA installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
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

    // iOS specific handling
    if (this.isIOS()) {
      if (!this.isStandalone()) {
        console.log('iOS: App needs to be installed to home screen');
        this.status.set('ios-needs-install');
        return;
      }
    }

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
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service worker registered');

        // Get FCM token
        const token = await getToken(messaging, {
          vapidKey: environment.firebase.vapidKey,
          serviceWorkerRegistration: registration
        });

        if (token) {
          console.log('FCM Token:', token);

          // Save token to Firestore
          const userRef = doc(this.firestore, 'users', userId);
          await updateDoc(userRef, { fcmToken: token });
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
    } catch (error) {
      console.error('Error setting up message listener:', error);
    }
  }
}
