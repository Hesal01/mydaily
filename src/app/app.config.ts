import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import {
  provideFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from '@angular/fire/firestore';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    // Cache persistant plutôt que le cache mémoire par défaut : sinon la grille
    // reste vide à chaque ouverture jusqu'à ce que le réseau réponde, alors que
    // le code, lui, vient du disque en quelques millisecondes. Elle se peint
    // maintenant tout de suite avec l'état de la dernière visite, puis se
    // réconcilie. On voit donc brièvement les données d'hier — préférable à un
    // écran vide, et l'app devient utilisable hors ligne au passage.
    //
    // `persistentMultipleTabManager` parce que rien n'empêche d'avoir la grille
    // ouverte dans deux onglets ; le gestionnaire mono-onglet ferait échouer le
    // cache dans le second.
    provideFirestore(() => initializeFirestore(getApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    }))
  ]
};
