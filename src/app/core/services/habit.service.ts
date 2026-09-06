import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, orderBy, onSnapshot, doc, setDoc, serverTimestamp, getDocs, arrayUnion, arrayRemove, deleteField } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HabitDay, HabitId, HabitCompletions, RawHabitCompletions, createEmptyCompletions, normalizeCompletions } from '../models/habit.model';
import { User } from '../models/user.model';
import { DEFAULT_SALON_ID } from '../models/salon.model';
import { DateService } from './date.service';
import { AuthService } from './auth.service';
import { HABITS } from '../constants/habits.constants';

export interface DailyStat {
  habitId: HabitId;
  icon: string;
  completed: number;
  total: number;
}

/**
 * Combien de temps la grille attend une réponse serveur avant de se contenter
 * du cache. Assez long pour que le cas normal passe par le serveur, assez court
 * pour qu'une ouverture ne reste pas bloquée.
 */
const SERVER_WAIT_MS = 1500;

/** Efface l'annonce en attente : trois champs qui vont toujours ensemble. */
const CLEAR_CLAIM = {
  studyClaimSurah: deleteField(),
  studyClaimVerse: deleteField(),
  studyClaimAt: deleteField()
};

@Injectable({ providedIn: 'root' })
export class HabitService {
  private firestore = inject(Firestore);
  private dateService = inject(DateService);
  private auth = inject(AuthService);

  /**
   * Salons de la personne, estampillés sur chaque journée écrite : c'est ce qui
   * rend une même journée visible dans toutes ses grilles à la fois.
   */
  private get salonIds(): string[] {
    const ids = this.auth.salonIds();
    return ids.length > 0 ? ids : [DEFAULT_SALON_ID];
  }

  /**
   * Les membres du salon uniquement.
   *
   * Le tri par `displayOrder` est fait côté client : combiné au filtre salon
   * il demanderait un index composite, pour une poignée de documents.
   *
   * `waitForServer: false` sert aux écrans qui préfèrent le cache immédiat à
   * un effectif complet (cf. la page Réglages, restée vide tant qu'elle
   * attendait une réponse serveur qui ne venait pas).
   */
  getAllUsers(salonId: string, options?: { waitForServer?: boolean }): Observable<User[]> {
    // Hors de la grille, rien ne saute de taille : mieux vaut le cache tout de
    // suite qu'un écran vide si la réponse serveur tarde — sur une page qui
    // n'ouvre que cette écoute, elle peut ne jamais venir.
    const waitForServer = options?.waitForServer !== false;
    return new Observable<User[]>(subscriber => {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('salonIds', 'array-contains', salonId));

      // Firestore émet d'abord son cache local, qui ne connaît pas forcément
      // tous les membres du salon — au premier lancement dans un salon rejoint,
      // souvent un seul. La grille se dessinerait alors sur un effectif partiel,
      // et comme la largeur d'une cellule est une fraction du nombre de
      // colonnes, tout sauterait de taille à l'arrivée du serveur. On attend
      // donc la première réponse serveur, sauf hors ligne où le cache est tout
      // ce qu'on aura.
      let servedOnce = false;
      // Dernier état connu du cache, gardé sous le coude : si le serveur ne
      // répond pas, c'est lui qu'on affichera plutôt qu'un écran d'attente.
      let cached: User[] | null = null;

      const emit = (users: User[]) => {
        servedOnce = true;
        subscriber.next(users);
      };

      // Filet : la réponse serveur peut ne jamais venir (flux Firestore établi
      // mais muet). Sans ce délai, l'app reste sur son rond qui tourne alors
      // que tout est déjà là — c'est l'ouverture « sans fin » déjà vue.
      const fallback = setTimeout(() => {
        if (!servedOnce && cached) emit(cached);
      }, SERVER_WAIT_MS);

      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const users = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as User))
            .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

          if (waitForServer && snapshot.metadata.fromCache && !servedOnce && navigator.onLine) {
            cached = users;
            return;
          }
          emit(users);
        },
        (error) => subscriber.error(error)
      );

      return () => {
        clearTimeout(fallback);
        unsubscribe();
      };
    });
  }

  /** Les habitudes visibles dans ce salon (index composite salonIds + date requis). */
  getAllHabitsRealtime(salonId: string): Observable<HabitDay[]> {
    const dates = this.dateService.getLastNDays(365);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    return new Observable<HabitDay[]>(subscriber => {
      const habitsRef = collection(this.firestore, 'habits');
      const q = query(
        habitsRef,
        where('salonIds', 'array-contains', salonId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );

      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const habits = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              userId: data['userId'],
              salonIds: data['salonIds'] ?? [],
              date: data['date'],
              completions: normalizeCompletions(data['completions'] as RawHabitCompletions || {}),
              updatedAt: data['updatedAt']
            } as HabitDay;
          });
          subscriber.next(habits);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  getCompletionsForUserAndDate(habits: HabitDay[], userId: string, date: string): HabitCompletions {
    const found = habits.find(h => h.userId === userId && h.date === date);
    return found?.completions ?? createEmptyCompletions();
  }

  async toggleHabit(userId: string, date: string, habitId: HabitId, currentCompletions: HabitCompletions): Promise<void> {
    const docId = `${date}_${userId}`;
    const docRef = doc(this.firestore, 'habits', docId);

    const newValue = !currentCompletions[habitId];

    const newCompletions = {
      ...currentCompletions,
      [habitId]: newValue
    };

    // Clear legacy doubleBook field when updating book
    const firestoreCompletions: Record<string, boolean | number> = { ...newCompletions };
    if (habitId === 'book') {
      firestoreCompletions['doubleBook'] = false;
    }

    await setDoc(docRef, {
      userId,
      salonIds: this.salonIds,
      date,
      completions: firestoreCompletions,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  async updateQuranPage(userId: string, page: number): Promise<void> {
    const clamped = Math.max(0, Math.min(604, page));
    const docRef = doc(this.firestore, 'users', userId);
    await setDoc(docRef, { quranPage: clamped }, { merge: true });
  }

  async updateQuranCycle(userId: string, cycle: number): Promise<void> {
    const docRef = doc(this.firestore, 'users', userId);
    await setDoc(docRef, { quranCycle: Math.max(0, cycle) }, { merge: true });
  }

  async setPrivacyMode(userId: string, enabled: boolean): Promise<void> {
    const docRef = doc(this.firestore, 'users', userId);
    await setDoc(docRef, { privacyMode: enabled }, { merge: true });
  }

  /**
   * Note que la personne a mis son lien d'accès de côté. Stocké côté serveur :
   * l'information doit survivre à l'effacement du stockage du navigateur, qui
   * est exactement le moment où ce lien devient vital.
   */
  async markAccessLinkSaved(userId: string): Promise<void> {
    const docRef = doc(this.firestore, 'users', userId);
    await setDoc(docRef, { linkSavedAt: serverTimestamp() }, { merge: true });
  }

  async markBookForToday(
    userId: string,
    date: string,
    currentCompletions: HabitCompletions,
    pagesDelta: number = 0
  ): Promise<void> {
    const existingPages = currentCompletions.bookPages ?? 0;
    const newPages = Math.max(0, existingPages + pagesDelta);
    const newBook = newPages > 0;
    if (newBook === currentCompletions.book && newPages === existingPages) return;
    const docId = `${date}_${userId}`;
    const docRef = doc(this.firestore, 'habits', docId);
    await setDoc(docRef, {
      userId,
      salonIds: this.salonIds,
      date,
      completions: {
        ...currentCompletions,
        book: newBook,
        doubleBook: false,
        bookPages: newPages
      },
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  // ===== Étude des sourates =====

  /**
   * Marque l'étude comme faite pour la journée et enregistre le dernier
   * verset atteint sur le doc user. (Pattern markBookForToday.)
   *
   * Écrit aussi l'avancée dans la mémoire par sourate (`studyProgress`).
   * Le merge Firestore fusionne les clés de la map sans écraser les autres.
   */
  async markStudyForToday(
    userId: string,
    date: string,
    currentCompletions: HabitCompletions,
    verse: number,
    surah: number,
    pending?: { claimedSince: number }
  ): Promise<void> {
    const habitDocRef = doc(this.firestore, 'habits', `${date}_${userId}`);
    await setDoc(habitDocRef, {
      userId,
      salonIds: this.salonIds,
      date,
      completions: {
        ...currentCompletions,
        study: true
      },
      updatedAt: serverTimestamp()
    }, { merge: true });

    const safeVerse = Math.max(0, verse);
    const userDocRef = doc(this.firestore, 'users', userId);

    if (pending) {
      // Un relecteur est en place : les versets sont annoncés, pas acquis.
      // `studyVerse` ne bougera qu'à son feu vert.
      await setDoc(userDocRef, {
        studyClaimSurah: surah,
        studyClaimVerse: safeVerse,
        studyClaimAt: pending.claimedSince,
        studyTouchedAt: { [surah]: Date.now() }
      }, { merge: true });
      return;
    }

    await setDoc(userDocRef, {
      studyVerse: safeVerse,
      studyProgress: { [surah]: safeVerse },
      studyTouchedAt: { [surah]: Date.now() }
    }, { merge: true });
  }

  /**
   * Décoche l'étude de la journée (ne touche pas à studyVerse).
   */
  async unmarkStudyForToday(
    userId: string,
    date: string,
    currentCompletions: HabitCompletions
  ): Promise<void> {
    const habitDocRef = doc(this.firestore, 'habits', `${date}_${userId}`);
    await setDoc(habitDocRef, {
      userId,
      salonIds: this.salonIds,
      date,
      completions: {
        ...currentCompletions,
        study: false
      },
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  /**
   * Choisit / change la sourate en cours et reprend au verset atteint.
   *
   * `resumeVerse` = dernier verset mémorisé pour la sourate choisie (0 si neuve).
   * Avant de basculer, l'avancée de la sourate quittée (`prevSurah`/`prevVerse`)
   * est sauvegardée dans la mémoire par sourate pour ne jamais être perdue —
   * y compris pour les users existants dont la map n'existe pas encore.
   */
  async updateStudySurah(
    userId: string,
    surahNumber: number,
    resumeVerse: number = 0,
    prevSurah?: number,
    prevVerse?: number
  ): Promise<void> {
    const docRef = doc(this.firestore, 'users', userId);
    const data: Record<string, unknown> = {
      studySurah: surahNumber,
      studyVerse: Math.max(0, resumeVerse),
      // Choisir une sourate est une activité : elle passe en tête de l'écran Étude.
      studyTouchedAt: { [surahNumber]: Date.now() },
      // Une annonce non relue ne survit pas au changement de sourate.
      ...CLEAR_CLAIM
    };
    if (prevSurah != null && prevSurah !== surahNumber && prevVerse != null && prevVerse > 0) {
      // Merge Firestore : fusionne cette clé de map sans écraser les autres.
      data['studyProgress'] = { [prevSurah]: prevVerse };
    }
    await setDoc(docRef, data, { merge: true });
  }

  /**
   * Repartir de zéro sur une sourate : efface son avancée et, si c'était la
   * sourate en cours, la quitte — le badge disparaît de la carte, et la
   * sourate redevient libre si personne d'autre n'y est. Les versets des
   * co-étudiants ne sont pas touchés.
   */
  async resetStudySurah(userId: string, surahNumber: number, wasCurrent: boolean): Promise<void> {
    const data: Record<string, unknown> = {
      studyProgress: { [surahNumber]: 0 },
      studyTouchedAt: { [surahNumber]: Date.now() },
      ...CLEAR_CLAIM
    };
    if (wasCurrent) {
      data['studySurah'] = deleteField();
      data['studyVerse'] = deleteField();
    }
    await setDoc(doc(this.firestore, 'users', userId), data, { merge: true });
  }

  /** Annulation du « repartir de zéro » : rend le verset et la sourate quittée. */
  async restoreStudySurah(
    userId: string,
    surahNumber: number,
    verse: number,
    becomeCurrent: boolean
  ): Promise<void> {
    const safeVerse = Math.max(0, verse);
    const data: Record<string, unknown> = {
      studyProgress: { [surahNumber]: safeVerse },
      studyTouchedAt: { [surahNumber]: Date.now() }
    };
    if (becomeCurrent) {
      data['studySurah'] = surahNumber;
      data['studyVerse'] = safeVerse;
    }
    await setDoc(doc(this.firestore, 'users', userId), data, { merge: true });
  }

  /**
   * Feu vert du relecteur : les versets annoncés deviennent acquis. Une
   * annonce qui va jusqu'au dernier verset termine la sourate — c'est le seul
   * chemin vers le n/114 quand un relecteur est en place.
   */
  async validateStudyClaim(
    userId: string,
    surahNumber: number,
    claimedVerse: number,
    totalVerses: number
  ): Promise<void> {
    const safeVerse = Math.max(0, claimedVerse);
    const finishes = totalVerses > 0 && safeVerse >= totalVerses;
    const data: Record<string, unknown> = {
      studyProgress: { [surahNumber]: safeVerse },
      studyTouchedAt: { [surahNumber]: Date.now() },
      ...CLEAR_CLAIM
    };
    if (finishes) {
      data['studyCompletedSurahs'] = arrayUnion(surahNumber);
      data['studySurah'] = deleteField();
      data['studyVerse'] = deleteField();
    } else {
      data['studyVerse'] = safeVerse;
    }
    await setDoc(doc(this.firestore, 'users', userId), data, { merge: true });
  }

  /**
   * Désigne (ou retire) le relecteur de l'étude pour un salon. Un seul à la
   * fois : l'appelant passe l'ancien pour qu'il soit démis dans la foulée.
   */
  async setStudyValidator(salonId: string, userId: string | null, previousUserId?: string | null): Promise<void> {
    if (previousUserId && previousUserId !== userId) {
      await setDoc(doc(this.firestore, 'users', previousUserId), {
        validatorSalonIds: arrayRemove(salonId)
      }, { merge: true });
    }
    if (userId) {
      await setDoc(doc(this.firestore, 'users', userId), {
        validatorSalonIds: arrayUnion(salonId)
      }, { merge: true });
    }
  }

  /**
   * Termine la sourate en cours : l'ajoute aux sourates terminées, mémorise
   * le total de versets dans la map (cohérence) et libère la sourate courante
   * (studySurah / studyVerse effacés).
   */
  async completeStudySurah(userId: string, surahNumber: number, totalVerses: number): Promise<void> {
    const docRef = doc(this.firestore, 'users', userId);
    await setDoc(docRef, {
      studyCompletedSurahs: arrayUnion(surahNumber),
      studyProgress: { [surahNumber]: Math.max(0, totalVerses) },
      studyTouchedAt: { [surahNumber]: Date.now() },
      studySurah: deleteField(),
      studyVerse: deleteField()
    }, { merge: true });
  }

  computeDailyStats(habits: HabitDay[], date: string, totalUsers: number): DailyStat[] {
    const todayHabits = habits.filter(h => h.date === date);

    return HABITS.map(habit => {
      const completed = todayHabits.filter(h => h.completions[habit.id]).length;
      return {
        habitId: habit.id,
        icon: habit.icon,
        completed,
        total: totalUsers
      };
    });
  }
}
