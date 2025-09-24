// Global test setup for deterministic behavior
// Use fake timers for consistent timing behavior first
jest.useFakeTimers('modern');

// Set system time to a fixed date for consistent test results
jest.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));

// Force UTC timezone
process.env.TZ = 'UTC';
process.env.LANG = 'C';

// Set up global test seed for consistent random behavior
global.testSeed = 12345;

// Reset modules and clear all mocks before each test for isolation
beforeEach(() => {
  jest.clearAllMocks();
  // Reset any module state that might bleed between tests
});

// Suppress console.warn in tests unless specifically needed
const originalWarn = console.warn;
beforeEach(() => {
  console.warn = jest.fn();
});

afterEach(() => {
  console.warn = originalWarn;
});