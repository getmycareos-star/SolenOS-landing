import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Preserve the global Jest API expected by the repository's existing test files
// while running the suite in native ESM mode.
Object.assign(globalThis, { jest });
