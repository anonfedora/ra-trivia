// Request coordinator to prevent API request storms on login

interface PendingRequest {
  key: string;
  promise: Promise<any>;
  timestamp: number;
}

class RequestCoordinator {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly DEBOUNCE_TIME = 100; // 100ms debounce
  private readonly MAX_CONCURRENT = 3; // Max concurrent requests

  async coordinate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if same request is already pending
    const existing = this.pendingRequests.get(key);
    if (existing && Date.now() - existing.timestamp < this.DEBOUNCE_TIME) {
      console.log(`[RequestCoordinator] Debouncing duplicate request: ${key}`);
      return existing.promise;
    }

    // Wait if too many concurrent requests
    if (this.pendingRequests.size >= this.MAX_CONCURRENT) {
      console.log(`[RequestCoordinator] Too many concurrent requests, waiting: ${key}`);
      await this.waitForSlot();
    }

    // Execute request
    const promise = requestFn();
    this.pendingRequests.set(key, {
      key,
      promise,
      timestamp: Date.now()
    });

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up after request completes
      setTimeout(() => {
        this.pendingRequests.delete(key);
      }, this.DEBOUNCE_TIME);
    }
  }

  private async waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      const checkSlot = () => {
        if (this.pendingRequests.size < this.MAX_CONCURRENT) {
          resolve();
        } else {
          setTimeout(checkSlot, 50);
        }
      };
      checkSlot();
    });
  }

  // Clear all pending requests (useful for logout)
  clear(): void {
    this.pendingRequests.clear();
  }

  // Get current pending request count
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

// Singleton instance
export const requestCoordinator = new RequestCoordinator();

import { apiFetch } from './api';

/**
 * Helper function for common API patterns
 */
export async function coordinatedFetch<T>(
  key: string, 
  url: string, 
  options?: RequestInit
): Promise<T> {
  return requestCoordinator.coordinate(key, async () => {
    const response = await apiFetch(url, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed: ${response.status}`);
    }
    return response.json();
  });
}
