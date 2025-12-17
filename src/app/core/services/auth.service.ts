import { Injectable, inject, signal, computed } from '@angular/core';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { SharedStorageService } from './shared-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private firestore = inject(Firestore);
  private sharedStorage = inject(SharedStorageService);

  private currentUserId = signal<string | null>(null);
  private loading = signal<boolean>(false);
  private initialized = signal<boolean>(false);

  readonly userId = this.currentUserId.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserId() !== null);
  readonly isLoading = this.loading.asReadonly();
  readonly isInitialized = this.initialized.asReadonly();

  constructor() {
    this.initSession();
  }

  private async initSession(): Promise<void> {
    // First, try sync localStorage for immediate UI
    const syncUserId = this.sharedStorage.getSync('mydaily_userId');
    if (syncUserId) {
      this.currentUserId.set(syncUserId);
    }

    // Then, try async cache storage (shared with PWA)
    const cachedUserId = await this.sharedStorage.get('mydaily_userId');
    if (cachedUserId) {
      this.currentUserId.set(cachedUserId);
    }

    this.initialized.set(true);
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
      await this.sharedStorage.set('mydaily_userId', userId);

      this.loading.set(false);
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      this.loading.set(false);
      return false;
    }
  }

  async logout(): Promise<void> {
    this.currentUserId.set(null);
    await this.sharedStorage.remove('mydaily_userId');
  }
}
