import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/auth/token-entry.component')
      .then(m => m.TokenEntryComponent)
  },
  {
    path: 'grid',
    loadComponent: () => import('./features/grid/grid.component')
      .then(m => m.GridComponent),
    canActivate: [authGuard]
  },
  {
    path: 'invalid-token',
    loadComponent: () => import('./features/auth/invalid-token.component')
      .then(m => m.InvalidTokenComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
