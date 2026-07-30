import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, increment } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Congrats } from '../models/congrats.model';
import { DEFAULT_SALON_ID } from '../models/salon.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CongratsService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);

  /**
   * Send a congratulation. The deterministic doc id keeps a single doc per
   * sender -> recipient per day, so the badge counter never inflates on spam.
   * Each send bumps `count` and clears `seen`, which lets the recipient replay
   * the celebration live for every clap (spam) without a new counted doc.
   */
  sendCongrats(from: string, to: string, date: string, emoji = '👏'): Promise<void> {
    const docId = `${date}_${to}_${from}`;
    const docRef = doc(this.firestore, 'congratulations', docId);
    return setDoc(docRef, {
      from,
      to,
      salonId: this.auth.salonId() ?? DEFAULT_SALON_ID,
      date,
      emoji,
      seen: false,
      count: increment(1),
      createdAt: serverTimestamp(),
      lastSentAt: serverTimestamp()
    }, { merge: true });
  }

  /** Mark a congratulation as seen once it has been celebrated in-app. */
  markSeen(congratsId: string): Promise<void> {
    const docRef = doc(this.firestore, 'congratulations', congratsId);
    return setDoc(docRef, { seen: true }, { merge: true });
  }

  /**
   * Live stream of every congratulation of the salon for a given day.
   * Equality filters only -> Firestore fusionne les index simples, aucun index
   * composite à créer.
   * Drives both the per-user count badges and the recipient's live animation.
   */
  getCongratsForDate(date: string, salonId: string): Observable<Congrats[]> {
    return new Observable<Congrats[]>(subscriber => {
      const ref = collection(this.firestore, 'congratulations');
      const q = query(ref, where('salonId', '==', salonId), where('date', '==', date));

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
              seen: (data['seen'] as boolean) ?? false,
              count: (data['count'] as number) ?? 1
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
