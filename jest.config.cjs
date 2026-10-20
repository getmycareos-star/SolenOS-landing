module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/testSetup.ts'],
  testMatch: ['<rootDir>/src/**/*.(spec|test).[tj]s?(x)', '<rootDir>/test.[tj]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/', '/tests/smoke/'],
  clearMocks: true,
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { diagnostics: false, tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
