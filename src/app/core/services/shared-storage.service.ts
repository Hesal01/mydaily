import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SharedStorageService {
  private cacheName = 'mydaily-auth';

  async set(key: string, value: string): Promise<void> {
    try {
      const cache = await caches.open(this.cacheName);
      const response = new Response(value);
      await cache.put(`/_shared/${key}`, response);
      // Also save to localStorage as fallback
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('SharedStorage set error:', error);
      // Fallback to localStorage only
      localStorage.setItem(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(`/_shared/${key}`);
      if (response) {
        return await response.text();
      }
      // Fallback to localStorage
      return localStorage.getItem(key);
    } catch (error) {
      console.error('SharedStorage get error:', error);
      // Fallback to localStorage
      return localStorage.getItem(key);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const cache = await caches.open(this.cacheName);
      await cache.delete(`/_shared/${key}`);
    } catch (error) {
      console.error('SharedStorage remove error:', error);
    }
    localStorage.removeItem(key);
  }

  // Sync method for immediate check (uses localStorage)
  getSync(key: string): string | null {
    return localStorage.getItem(key);
  }
}
