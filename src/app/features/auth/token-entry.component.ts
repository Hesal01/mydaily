import { Component, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-token-entry',
  standalone: true,
  template: `
    <div class="container">
      @if (isLoading) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Connexion en cours...</p>
        </div>
      } @else if (error) {
        <div class="error">
          <h2>Lien invalide</h2>
          <p>Ce lien d'accès n'est pas valide ou a expiré.</p>
        </div>
      } @else {
        <div class="waiting">
          <h1>MyDaily</h1>
          <p>Utilisez votre lien personnel pour accéder à l'application.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .loading, .error, .waiting {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }
    h2 {
      color: #ff6b6b;
    }
    p {
      opacity: 0.8;
    }
  `]
})
export class TokenEntryComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  isLoading = false;
  error = false;

  async ngOnInit(): Promise<void> {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/grid']);
      return;
    }

    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      return;
    }

    this.isLoading = true;
    const success = await this.authService.authenticateWithToken(token);
    this.isLoading = false;

    if (success) {
      this.router.navigate(['/grid']);
    } else {
      this.error = true;
    }
  }
}
