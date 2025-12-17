import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Attendre l'initialisation
  while (!authService.isInitialized()) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Déjà authentifié
  if (authService.isAuthenticated()) {
    return true;
  }

  // Vérifier si token dans l'URL (pour PWA iOS)
  const token = route.queryParamMap.get('token');
  if (token) {
    const success = await authService.authenticateWithToken(token);
    if (success) {
      return true;
    }
  }

  // Rediriger vers login
  router.navigate(['/']);
  return false;
};
