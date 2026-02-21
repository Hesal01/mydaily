import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-quran-modal',
  standalone: true,
  template: `
    <div class="backdrop" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-title">Page du Coran</div>

        <div class="current-page">
          Page {{ page() }} / 604
        </div>

        <div class="quick-buttons">
          <button class="quick-btn" (click)="increment(5)">+5</button>
          <button class="quick-btn" (click)="increment(10)">+10</button>
        </div>

        <div class="select-row">
          <label for="page-select">Aller à la page :</label>
          <select id="page-select" [value]="page()" (change)="onSelectChange($event)">
            @for (p of pages; track p) {
              <option [value]="p" [selected]="p === page()">{{ p }}</option>
            }
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn-close" (click)="close.emit()">Fermer</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      background: #ffffff;
      border-radius: 16px;
      padding: 24px;
      width: min(320px, 90vw);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
    .modal-title {
      font-size: 18px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 16px;
      color: #1f2328;
    }
    .current-page {
      text-align: center;
      font-size: 24px;
      font-weight: 700;
      color: #2da44e;
      margin-bottom: 20px;
    }
    .quick-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 20px;
    }
    .quick-btn {
      flex: 1;
      padding: 12px;
      border-radius: 10px;
      border: 2px solid #2da44e;
      background: #ffffff;
      color: #2da44e;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      touch-action: manipulation;
    }
    .quick-btn:active {
      background: #2da44e;
      color: #ffffff;
    }
    .select-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }
    .select-row label {
      font-size: 14px;
      color: #656d76;
    }
    .select-row select {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #d0d7de;
      font-size: 16px;
      background: #f6f8fa;
      color: #1f2328;
      -webkit-appearance: none;
      appearance: none;
    }
    .modal-actions {
      display: flex;
      justify-content: center;
    }
    .btn-close {
      padding: 10px 32px;
      border-radius: 8px;
      border: 1px solid #d0d7de;
      background: #f6f8fa;
      color: #1f2328;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      touch-action: manipulation;
    }
    .btn-close:active {
      background: #eaeef2;
    }
  `]
})
export class QuranModalComponent {
  readonly currentPage = input.required<number>();
  readonly pageChanged = output<number>();
  readonly close = output<void>();

  readonly page = signal(0);
  readonly pages = Array.from({ length: 604 }, (_, i) => i + 1);

  constructor() {
    // Can't use effect with input signals in constructor reliably,
    // so we use ngOnInit pattern via signal
  }

  ngOnInit() {
    this.page.set(this.currentPage() || 0);
  }

  increment(amount: number): void {
    const newPage = Math.min(604, this.page() + amount);
    this.page.set(newPage);
    this.pageChanged.emit(newPage);
  }

  onSelectChange(event: Event): void {
    const value = +(event.target as HTMLSelectElement).value;
    this.page.set(value);
    this.pageChanged.emit(value);
  }
}
