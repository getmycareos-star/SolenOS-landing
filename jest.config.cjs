module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  setupFilesAfterEnv: ['<rootDir>/src/testSetup.ts'],
  testMatch: [
    '<rootDir>/src/vite-pages/**/*.test.ts',
    '<rootDir>/src/vite-pages/**/*.test.tsx',
    '<rootDir>/src/api/**/*.test.ts',
    '<rootDir>/src/lib/**/*.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/', '/tests/smoke/'],
  clearMocks: true,
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { useESM: true, diagnostics: false, tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
