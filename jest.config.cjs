module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/testSetup.ts'],
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  clearMocks: true,
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { diagnostics: false }],
  },
};
