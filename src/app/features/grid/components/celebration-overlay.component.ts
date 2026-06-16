import { Component, input } from '@angular/core';

export interface CelebrationParticle {
  tx: string;
  ty: string;
  rot: string;
  color: string;
  isEmoji: boolean;
  char: string;
  delay: number;
}

export interface CelebrationBurst {
  id: number;
  x: number;
  y: number;
  particles: CelebrationParticle[];
}

/**
 * Full-screen, non-interactive layer that plays congratulation bursts
 * (confetti + halo + ring + a popping clap) anchored at viewport coordinates,
 * plus a transient toast. Purely presentational: the parent owns timing.
 */
@Component({
  selector: 'app-celebration-overlay',
  standalone: true,
  template: `
    <div class="overlay">
      @for (b of bursts(); track b.id) {
        <div class="burst" [style.left.px]="b.x" [style.top.px]="b.y">
          <div class="halo"></div>
          <div class="ring"></div>
          <div class="big-clap">👏</div>
          @for (p of b.particles; track $index) {
            <span
              class="particle"
              [class.is-emoji]="p.isEmoji"
              [style.--tx]="p.tx"
              [style.--ty]="p.ty"
              [style.--rot]="p.rot"
              [style.background]="p.isEmoji ? 'transparent' : p.color"
              [style.animation-delay.ms]="p.delay"
            >{{ p.isEmoji ? p.char : '' }}</span>
          }
        </div>
      }
      @if (toast()) {
        <div class="toast">{{ toast() }}</div>
      }
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 9999;
    }
    .burst {
      position: absolute;
      width: 0;
      height: 0;
    }
    .halo {
      position: absolute;
      left: 0;
      top: 0;
      width: 24px;
      height: 24px;
      margin: -12px 0 0 -12px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(245, 183, 0, 0.6), rgba(245, 183, 0, 0) 70%);
      animation: halo-grow 700ms ease-out forwards;
    }
    .ring {
      position: absolute;
      left: 0;
      top: 0;
      width: 20px;
      height: 20px;
      margin: -10px 0 0 -10px;
      border-radius: 50%;
      border: 3px solid rgba(245, 183, 0, 0.85);
      animation: ring-grow 600ms ease-out forwards;
    }
    .big-clap {
      position: absolute;
      left: 0;
      top: 0;
      font-size: 30px;
      animation: clap-pop 850ms ease-out forwards;
    }
    .particle {
      position: absolute;
      left: 0;
      top: 0;
      width: 8px;
      height: 8px;
      margin: -4px 0 0 -4px;
      border-radius: 2px;
      animation: particle-fly 950ms cubic-bezier(0.17, 0.67, 0.32, 1) both;
      will-change: transform, opacity;
    }
    .particle.is-emoji {
      width: auto;
      height: auto;
      margin: 0;
      font-size: 18px;
      border-radius: 0;
    }
    @keyframes halo-grow {
      0% { transform: scale(0.3); opacity: 0.9; }
      100% { transform: scale(8); opacity: 0; }
    }
    @keyframes ring-grow {
      0% { transform: scale(0.3); opacity: 0.9; }
      100% { transform: scale(6); opacity: 0; }
    }
    @keyframes clap-pop {
      0% { transform: translate(-50%, -50%) scale(0) rotate(-25deg); opacity: 0; }
      25% { transform: translate(-50%, -120%) scale(1.35) rotate(10deg); opacity: 1; }
      100% { transform: translate(-50%, -210%) scale(0.9) rotate(0deg); opacity: 0; }
    }
    @keyframes particle-fly {
      0% { transform: translate(0, 0) rotate(0deg) scale(0.4); opacity: 1; }
      70% { opacity: 1; }
      100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(1); opacity: 0; }
    }
    .toast {
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      max-width: 88vw;
      background: rgba(31, 35, 40, 0.96);
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      animation: toast-in 0.3s ease-out, toast-out 0.4s ease-in 2.2s forwards;
    }
    @keyframes toast-in {
      0% { transform: translate(-50%, -24px); opacity: 0; }
      100% { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes toast-out {
      0% { transform: translate(-50%, 0); opacity: 1; }
      100% { transform: translate(-50%, -24px); opacity: 0; }
    }
  `]
})
export class CelebrationOverlayComponent {
  bursts = input<CelebrationBurst[]>([]);
  toast = input<string | null>(null);
}
