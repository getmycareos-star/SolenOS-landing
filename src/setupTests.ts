import '@testing-library/jest-dom'
import { jest } from '@jest/globals'

Object.assign(globalThis, { jest })

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
