import '@testing-library/jest-dom'

// Mock Web Worker
const mockWorker = class Worker {
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private lastMessage: any = null;

  constructor(url: string) {
    this.url = url;
  }

  postMessage(message: any) {
    // Store the message for test access
    this.lastMessage = message;

    // Mock implementation - forward the message to onmessage handler
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', {
          data: {
            type: 'message_received',
            originalMessage: message,
            // You can customize the response based on the message type
            response: this.generateMockResponse(message)
          }
        }));
      }
    }, 0);
  }

  private generateMockResponse(message: any): any {
    // Generate appropriate mock responses based on message content
    if (message && typeof message === 'object' && message.type) {
      switch (message.type) {
        case 'process_credentials':
          return { success: true, result: { baseURL: 'https://example.com', authMode: 'Bearer' } };
        case 'validate_input':
          return { valid: true };
        default:
          return { type: 'echo', data: message };
      }
    }
    return { type: 'unknown_message', data: message };
  }

  // Method to access the last message sent (useful for tests)
  getLastMessage(): any {
    return this.lastMessage;
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
