import { webcrypto } from 'node:crypto'

// Polyfill crypto for Node.js environments
if (!globalThis.crypto) {
  try {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      writable: false,
      configurable: true
    })
  } catch (error) {
    // If that fails, try setting it directly on global
    if (typeof global !== 'undefined' && !global.crypto) {
      (global as any).crypto = webcrypto
    }
  }
} 