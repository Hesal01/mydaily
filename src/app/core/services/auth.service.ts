import { Injectable, inject, signal, computed } from '@angular/core';
import { Firestore, collection, query, where, getDocs, doc, setDoc, onSnapshot, serverTimestamp } from '@angular/fire/firestore';
import { SharedStorageService } from './shared-storage.service';
import { DEFAULT_SALON_ID } from '../models/salon.model';

const USER_KEY = 'mydaily_userId';
/** Salon actuellement consulté, quand la personne en a plusieurs. */
const SALON_KEY = 'mydaily_salonId';

/**
 * Plafond de lecture du stockage au démarrage. Le Cache Storage répond
 * normalement en quelques millisecondes, mais quand il ne répond pas du tout
 * — et ça arrive au réveil d'une PWA — rien ne réveille l'app : les écrans
 * attendent `isInitialized()` en boucle et la personne reste devant un écran
 * blanc jusqu'à ce qu'elle tue l'app. Passé ce délai on démarre avec ce que
 * localStorage a déjà donné, qui suffit à reconnaître quelqu'un de connu.
 */
const STORAGE_TIMEOUT_MS = 3000;

/** Rend une promesse bornée : sa valeur, ou le repli si elle traîne trop. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

/** Appartenances d'un doc user, tolérant au format d'avant les salons multiples. */
function readSalonIds(data: Record<string, unknown> | undefined): string[] {
  const list = data?.['salonIds'];
  if (Array.isArray(list) && list.length > 0) return list as string[];
  const single = data?.['salonId'];
  return typeof single === 'string' ? [single] : [DEFAULT_SALON_ID];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private firestore = inject(Firestore);
  private sharedStorage = inject(SharedStorageService);

  private currentUserId = signal<string | null>(null);
  private currentSalonIds = signal<string[]>([]);
  private activeSalonId = signal<string | null>(null);
  private loading = signal<boolean>(false);
  private initialized = signal<boolean>(false);
  private unwatchUser: (() => void) | null = null;

  readonly userId = this.currentUserId.asReadonly();
  /** Tous les salons de la personne. */
  readonly salonIds = this.currentSalonIds.asReadonly();
  /** Salon consulté : toutes les lectures de données en dépendent. */
  readonly salonId = this.activeSalonId.asReadonly();
  readonly hasMultipleSalons = computed(() => this.currentSalonIds().length > 1);
  readonly isAuthenticated = computed(() => this.currentUserId() !== null);
  readonly isLoading = this.loading.asReadonly();
  readonly isInitialized = this.initialized.asReadonly();

  constructor() {
    this.initSession();
  }

  private async initSession(): Promise<void> {
    // First, try sync localStorage for immediate UI
    const syncUserId = this.sharedStorage.getSync(USER_KEY);
    if (syncUserId) {
      this.currentUserId.set(syncUserId);
      this.activeSalonId.set(this.sharedStorage.getSync(SALON_KEY));
    }

    // Then, try async cache storage (shared with PWA)
    const cachedUserId = await withTimeout(this.sharedStorage.get(USER_KEY), STORAGE_TIMEOUT_MS, syncUserId);
    if (cachedUserId) {
      this.currentUserId.set(cachedUserId);
      void this.sharedStorage.requestPersistence();
      const cachedSalonId = await withTimeout(this.sharedStorage.get(SALON_KEY), STORAGE_TIMEOUT_MS, null);
      if (cachedSalonId) this.activeSalonId.set(cachedSalonId);

      const watching = this.watchUser(cachedUserId);
      if (!cachedSalonId) {
        // Salon inconnu (session d'avant les salons) : il faut le doc user avant
        // que les écrans ne se branchent dessus. Borné dans le temps pour qu'un
        // réseau absent ne bloque pas le démarrage sur le spinner.
        await Promise.race([
          watching,
          new Promise<void>(resolve => setTimeout(resolve, 5000))
        ]);
      }
    }

    this.initialized.set(true);
  }

  /**
   * Attend la fin de l'initialisation, sans jamais attendre pour toujours.
   * `initSession()` borne déjà ses lectures, mais deux écrans dépendent de ce
   * signal pour s'afficher : une boucle sans plafond ici et le moindre grain de
   * sable laisse un écran blanc que seule la relance de l'app dénoue. Au-delà
   * du délai on continue avec la session lue dans localStorage, qui est déjà
   * posée de façon synchrone au tout début de `initSession()`.
   */
  async waitUntilInitialized(timeoutMs = 8000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (!this.initialized() && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return this.initialized();
  }

  /**
   * Suit le doc user en temps réel : l'appartenance aux salons peut changer
   * pendant la session (ajout à un nouveau salon côté admin), et le sélecteur
   * doit s'ajuster sans reconnexion.
   */
  private watchUser(userId: string): Promise<void> {
    this.unwatchUser?.();

    return new Promise<void>(resolve => {
      let settled = false;
      this.unwatchUser = onSnapshot(
        doc(this.firestore, 'users', userId),
        snap => {
          this.applySalonIds(readSalonIds(snap.data()));
          if (!settled) { settled = true; resolve(); }
        },
        error => {
          console.error('User watch error:', error);
          if (!settled) { settled = true; resolve(); }
        }
      );
    });
  }

  /** Garde le salon actif dans les salons de la personne. */
  private applySalonIds(salonIds: string[]): void {
    this.currentSalonIds.set(salonIds);
    const active = this.activeSalonId();
    if (!active || !salonIds.includes(active)) {
      this.setActiveSalon(salonIds[0] ?? DEFAULT_SALON_ID);
    }
  }

  private setActiveSalon(salonId: string): void {
    this.activeSalonId.set(salonId);
    void this.sharedStorage.set(SALON_KEY, salonId);
  }

  /** Bascule la grille sur un autre salon de la personne. */
  switchSalon(salonId: string): void {
    if (!this.currentSalonIds().includes(salonId)) return;
    if (salonId === this.activeSalonId()) return;
    this.setActiveSalon(salonId);
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

      if (userId === 'user_9' && !userDoc.data()['firstConnectedAt']) {
        const userRef = doc(this.firestore, 'users', userId);
        await setDoc(userRef, { firstConnectedAt: serverTimestamp() }, { merge: true });
      }

      this.currentUserId.set(userId);
      this.applySalonIds(readSalonIds(userDoc.data()));
      await this.sharedStorage.set(USER_KEY, userId);
      // Dès la première session : sans stockage persistant, elle ne passera
      // pas la semaine et il faudra ressaisir ce token.
      void this.sharedStorage.requestPersistence();
      await this.watchUser(userId);

      this.loading.set(false);
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      this.loading.set(false);
      return false;
    }
  }

  async logout(): Promise<void> {
    this.unwatchUser?.();
    this.unwatchUser = null;
    this.currentUserId.set(null);
    this.currentSalonIds.set([]);
    this.activeSalonId.set(null);
    await this.sharedStorage.remove(USER_KEY);
    await this.sharedStorage.remove(SALON_KEY);
  }
}
