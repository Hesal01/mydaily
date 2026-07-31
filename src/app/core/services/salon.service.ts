import { Injectable, inject, signal, effect, computed } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Salon } from '../models/salon.model';
import { HabitId } from '../models/habit.model';
import { HABITS } from '../constants/habits.constants';
import { AuthService } from './auth.service';

/**
 * Noms des salons de la personne, pour le sélecteur.
 *
 * Les docs `salons` ne bougent jamais après création : une lecture ponctuelle
 * par salon suffit, pas besoin de temps réel. Le cache évite de relire à chaque
 * bascule.
 */
@Injectable({ providedIn: 'root' })
export class SalonService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);

  private cache = new Map<string, Salon>();
  private readonly salonsSignal = signal<Salon[]>([]);

  /** Les salons de la personne, dans l'ordre de ses appartenances. */
  readonly mySalons = this.salonsSignal.asReadonly();

  constructor() {
    // allowSignalWrites : l'effet suit les appartenances et met à jour la liste
    // des salons, ce qui est une écriture de signal depuis un effet.
    effect(() => {
      const ids = this.auth.salonIds();
      if (ids.length === 0) {
        this.salonsSignal.set([]);
        return;
      }
      void this.load(ids);
    }, { allowSignalWrites: true });
  }

  private async load(ids: string[]): Promise<void> {
    const salons = await Promise.all(ids.map(id => this.fetch(id)));
    // Le signal a pu changer pendant les lectures : on n'écrase pas un état plus récent.
    if (this.auth.salonIds().join() === ids.join()) {
      this.salonsSignal.set(salons);
    }
  }

  private async fetch(id: string): Promise<Salon> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    let salon: Salon = { id, name: id };
    try {
      const snap = await getDoc(doc(this.firestore, 'salons', id));
      const data = snap.data();
      const name = data?.['name'] as string | undefined;
      const habitIds = data?.['habitIds'] as HabitId[] | undefined;
      if (name) salon = { id, name };
      if (Array.isArray(habitIds) && habitIds.length > 0) salon = { ...salon, habitIds };
    } catch (error) {
      console.error('Salon fetch error:', error);
    }
    this.cache.set(id, salon);
    return salon;
  }

  /** Le salon affiché, une fois sa lecture faite. */
  readonly currentSalon = computed(() => {
    const id = this.auth.salonId();
    return id ? this.salonsSignal().find(s => s.id === id) ?? null : null;
  });

  /**
   * Habitudes du salon affiché. Un salon sans `habitIds` les suit toutes, ce
   * qui garde les salons d'avant ce champ à l'identique.
   */
  readonly currentHabits = computed(() => {
    const ids = this.currentSalon()?.habitIds;
    if (!ids || ids.length === 0) return HABITS;
    return HABITS.filter(h => ids.includes(h.id));
  });
}
