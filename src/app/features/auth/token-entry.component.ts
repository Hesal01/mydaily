import { Component, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-token-entry',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container">
      @if (isLoading) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Connexion en cours...</p>
        </div>
      } @else if (error) {
        <div class="error">
          <h2>Token invalide</h2>
          <p>Ce token n'est pas valide.</p>
          <button class="retry-btn" (click)="retry()">Réessayer</button>
        </div>
      } @else {
        <div class="waiting">
          <h1>MyDaily</h1>
          <p>Entre ton token pour te connecter</p>
          <div class="input-group">
            <input
              type="text"
              [(ngModel)]="tokenInput"
              placeholder="Token..."
              (keyup.enter)="login()"
            />
            <button (click)="login()" [disabled]="!tokenInput.trim()">→</button>
          </div>
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
      min-height: 100dvh;
      background: #ffffff;
      color: #1f2328;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .loading, .error, .waiting {
      text-align: center;
      padding: 2rem;
      width: 100%;
      max-width: 300px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #eaeef2;
      border-top-color: #2da44e;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #1f2328;
    }
    h2 {
      color: #cf222e;
    }
    p {
      color: #656d76;
      margin-bottom: 1.5rem;
    }
    .input-group {
      display: flex;
      gap: 8px;
    }
    input {
      flex: 1;
      padding: 12px 16px;
      font-size: 16px;
      border: 1px solid #d0d7de;
      border-radius: 8px;
      outline: none;
    }
    input:focus {
      border-color: #2da44e;
      box-shadow: 0 0 0 3px rgba(45, 164, 78, 0.15);
    }
    button {
      padding: 12px 20px;
      font-size: 18px;
      background: #2da44e;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    button:disabled {
      background: #94d3a2;
      cursor: not-allowed;
    }
    button:hover:not(:disabled) {
      background: #238636;
    }
    .retry-btn {
      margin-top: 1rem;
      padding: 10px 24px;
      font-size: 14px;
    }
    `]
})
export class TokenEntryComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  tokenInput = '';
  isLoading = true;
  error = false;

  async ngOnInit(): Promise<void> {
    // Attendre que le cache storage soit lu
    while (!this.authService.isInitialized()) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.isLoading = false;

    const urlToken = this.route.snapshot.queryParamMap.get('token');

    if (this.authService.isAuthenticated()) {
      // Garder le token dans l'URL pour la PWA
      this.router.navigate(['/grid'], { queryParams: { token: urlToken } });
      return;
    }

    if (urlToken) {
      await this.authenticate(urlToken);
    }
  }

  async login(): Promise<void> {
    const token = this.tokenInput.trim();
    if (!token) return;
    await this.authenticate(token);
  }

  private async authenticate(token: string): Promise<void> {
    this.isLoading = true;
    this.error = false;

    const success = await this.authService.authenticateWithToken(token);
    this.isLoading = false;

    if (success) {
      // Garder le token dans l'URL pour la PWA
      this.router.navigate(['/grid'], { queryParams: { token } });
    } else {
      this.error = true;
    }
  }

  retry(): void {
    this.error = false;
    this.tokenInput = '';
  }
}
