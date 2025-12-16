import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-invalid-token',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <div class="content">
        <h1>Accès refusé</h1>
        <p>Ce lien n'est pas valide ou a expiré.</p>
        <p class="hint">Vérifiez que vous utilisez le bon lien d'accès.</p>
      </div>
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
    .content {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      color: #ff6b6b;
      margin-bottom: 1rem;
    }
    .hint {
      opacity: 0.6;
      font-size: 0.9rem;
      margin-top: 1rem;
    }
  `]
})
export class InvalidTokenComponent {}
