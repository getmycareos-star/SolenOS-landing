import '@testing-library/jest-dom';

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
