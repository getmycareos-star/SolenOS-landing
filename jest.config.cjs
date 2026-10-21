module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/src/lib/routine-moments/test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/', '/tests/smoke/'],
  clearMocks: true,
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', {
      useESM: true,
      diagnostics: false,
      tsconfig: '<rootDir>/tsconfig.jest.json',
    }],
  },
};
