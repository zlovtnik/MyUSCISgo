import '@testing-library/jest-dom'

// Mock Web Worker
const mockWorker = class Worker {
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  postMessage() {
    // Mock implementation - in real tests you might want to simulate responses
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', {
          data: { type: 'initialized' }
        }));
      }
    }, 0);
  }

  terminate() {
    // Mock implementation
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') {
      this.onmessage = listener as (e: MessageEvent) => void;
    } else if (type === 'error') {
      this.onerror = listener as (e: ErrorEvent) => void;
    }
  }

  removeEventListener(type: string) {
    if (type === 'message') {
      this.onmessage = null;
    } else if (type === 'error') {
      this.onerror = null;
    }
  }
};

// Mock global Worker for tests
(globalThis as unknown as { Worker: unknown }).Worker = mockWorker;

// Mock fetch for WASM loading
(globalThis as unknown as { fetch: unknown }).fetch = () =>
  Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  });
