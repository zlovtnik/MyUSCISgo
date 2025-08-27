import '@testing-library/jest-dom'

// Mock Web Worker
const mockWorker = class Worker {
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  postMessage(_message: any) {
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

  addEventListener(type: string, listener: any) {
    if (type === 'message') {
      this.onmessage = listener;
    } else if (type === 'error') {
      this.onerror = listener;
    }
  }

  removeEventListener(type: string, listener: any) {
    if (type === 'message') {
      this.onmessage = null;
    } else if (type === 'error') {
      this.onerror = listener;
    }
  }
};

(globalThis as any).Worker = mockWorker;

// Mock fetch for WASM loading
(globalThis as any).fetch = () =>
  Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  });
