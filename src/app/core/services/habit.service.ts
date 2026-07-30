import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, orderBy, onSnapshot, doc, setDoc, serverTimestamp, getDocs, arrayUnion, deleteField } from '@angular/fire/firestore';
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
   */
  getAllUsers(salonId: string): Observable<User[]> {
    return new Observable<User[]>(subscriber => {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('salonIds', 'array-contains', salonId));

      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const users = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as User))
            .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          subscriber.next(users);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
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
    surah: number
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
    await setDoc(userDocRef, {
      studyVerse: safeVerse,
      studyProgress: { [surah]: safeVerse }
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
      studyVerse: Math.max(0, resumeVerse)
    };
    if (prevSurah != null && prevSurah !== surahNumber && prevVerse != null && prevVerse > 0) {
      // Merge Firestore : fusionne cette clé de map sans écraser les autres.
      data['studyProgress'] = { [prevSurah]: prevVerse };
    }
    await setDoc(docRef, data, { merge: true });
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
