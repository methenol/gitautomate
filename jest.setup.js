/**
 * Jest setup file for deterministic test environment
 * Following issue #46 Step 3: Determinism & Test Env requirements
 */

// Step 3.1: Set global seed and freeze time
jest.useFakeTimers('modern');
jest.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));

// Step 3.2: Force TZ to UTC and set LANG=C
process.env.TZ = 'UTC';
process.env.LANG = 'C';

// Step 3.3: Global seed for consistent randomness
// Store original Math.random before overriding to avoid breaking internal tools
const originalMathRandom = Math.random;
const seedrandom = require('seedrandom');
const seededRandom = seedrandom('deterministic-test-seed-12345');

// Only override Math.random in test contexts, not globally
beforeEach(() => {
  // Apply seeded random only for application code, not tooling
  if (typeof global.testContext !== 'undefined') {
    Math.random = seededRandom;
  }
});

afterEach(() => {
  // Restore original Math.random after each test
  Math.random = originalMathRandom;
});

// Step 3.4: Per-test isolation - reset modules/mocks, clear env overrides
beforeEach(() => {
  jest.clearAllMocks();
  // Don't reset modules as it can break source maps and other tooling
  
  // Preserve essential environment variables while clearing test overrides
  const essentialEnvVars = ['TZ', 'LANG', 'NODE_ENV'];
  const preservedVars = {};
  essentialEnvVars.forEach(key => {
    if (process.env[key]) preservedVars[key] = process.env[key];
  });
  
  // Clear test-specific env vars (those set during tests)
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('TEST_') || key.startsWith('MOCK_')) {
      delete process.env[key];
    }
  });
  
  // Restore essential vars
  Object.assign(process.env, preservedVars);
});

// Suppress console warnings and logs for cleaner test output unless specifically testing them
const originalConsole = { ...console };
beforeEach(() => {
  if (!process.env.PRESERVE_CONSOLE) {
    console.warn = jest.fn();
    console.log = jest.fn();
    console.info = jest.fn();
  }
});

afterEach(() => {
  if (!process.env.PRESERVE_CONSOLE) {
    console.warn = originalConsole.warn;
    console.log = originalConsole.log;
    console.info = originalConsole.info;
  }
});