import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Congrats } from '../models/congrats.model';

@Injectable({ providedIn: 'root' })
export class CongratsService {
  private firestore = inject(Firestore);

  /**
   * Send a congratulation. The deterministic doc id guarantees
   * one congratulation per sender -> recipient per day (no spam).
   */
  sendCongrats(from: string, to: string, date: string, emoji = '👏'): Promise<void> {
    const docId = `${date}_${to}_${from}`;
    const docRef = doc(this.firestore, 'congratulations', docId);
    return setDoc(docRef, {
      from,
      to,
      date,
      emoji,
      seen: false,
      createdAt: serverTimestamp()
    }, { merge: true });
  }

  /** Mark a congratulation as seen once it has been celebrated in-app. */
  markSeen(congratsId: string): Promise<void> {
    const docRef = doc(this.firestore, 'congratulations', congratsId);
    return setDoc(docRef, { seen: true }, { merge: true });
  }

  /**
   * Live stream of every congratulation for a given day.
   * Single equality filter -> no composite index required.
   * Drives both the per-user count badges and the recipient's live animation.
   */
  getCongratsForDate(date: string): Observable<Congrats[]> {
    return new Observable<Congrats[]>(subscriber => {
      const ref = collection(this.firestore, 'congratulations');
      const q = query(ref, where('date', '==', date));

      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const items = snapshot.docs.map(d => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              from: data['from'] as string,
              to: data['to'] as string,
              date: data['date'] as string,
              emoji: (data['emoji'] as string) ?? '👏',
              seen: (data['seen'] as boolean) ?? false
            } as Congrats;
          });
          subscriber.next(items);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }
}
