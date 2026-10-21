import '@testing-library/jest-dom';

Object.defineProperty(window, 'alert', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});

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
