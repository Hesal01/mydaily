import { Injectable, inject, signal, computed } from '@angular/core';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private firestore = inject(Firestore);

  private currentUserId = signal<string | null>(null);
  private loading = signal<boolean>(false);

  readonly userId = this.currentUserId.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserId() !== null);
  readonly isLoading = this.loading.asReadonly();

  constructor() {
    this.tryRestoreSession();
  }

  private tryRestoreSession(): void {
    const storedUserId = sessionStorage.getItem('mydaily_userId');
    if (storedUserId) {
      this.currentUserId.set(storedUserId);
    }
  }

  async authenticateWithToken(token: string): Promise<boolean> {
    this.loading.set(true);

    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('token', '==', token));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        this.loading.set(false);
        return false;
      }

      const userDoc = snapshot.docs[0];
      const userId = userDoc.id;

      this.currentUserId.set(userId);
      sessionStorage.setItem('mydaily_userId', userId);

      this.loading.set(false);
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      this.loading.set(false);
      return false;
    }
  }

  logout(): void {
    this.currentUserId.set(null);
    sessionStorage.removeItem('mydaily_userId');
  }
}
