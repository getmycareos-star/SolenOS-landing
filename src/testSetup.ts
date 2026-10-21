import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Jest 30's ESM mode does not inject the CommonJS-style global automatically.
// Keep the existing tests working under native ESM by exposing the supported API
// from @jest/globals before each test module is evaluated.
Object.assign(globalThis, { jest });

// jsdom does not implement blob URL APIs; browser image-compression and preview flows require them.
Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  writable: true,
  value: jest.fn(() => 'blob:solenos-test-image'),
});
Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});

// Avoid jsdom's "Not implemented" noise; component behavior is asserted through rendered state.
Object.defineProperty(window, 'alert', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});
