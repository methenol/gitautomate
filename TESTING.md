# Testing Guide

This document provides comprehensive testing guidelines for the GitAutomate project.

## Quick Start

### Fast Commands
```bash
# Run all tests (fast)
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- --testPathPatterns="library-identifier.test.ts"

# Run tests in watch mode (development)
npm run test:watch
```

### Full Commands
```bash
# Run all tests with verbose output
npm test -- --verbose --runInBand

# Run tests with coverage and threshold enforcement
npm test -- --coverage --coverageThreshold='{"global":{"lines":85,"branches":80}}'

# Run tests 50 times to detect flakes
for i in {1..50}; do npm test -- --silent || break; done
```

## Coverage Requirements

### Thresholds
- **Global**: Lines ≥ 85%, Branches ≥ 80%, Functions ≥ 85%
- **Critical modules** (`src/ai/`, `src/lib/`, `src/services/`): Lines ≥ 90-95%, Branches ≥ 85-90%

### Coverage Commands
```bash
# Generate coverage report
npm test -- --coverage

# Coverage with detailed output
npm test -- --coverage --coverageReporters=text --coverageReporters=html

# Check only coverage without running tests (if cache exists)
npm test -- --coverage --passWithNoTests
```

## Test Environment Setup

### Deterministic Behavior
All tests use a deterministic environment:
- **Fixed time**: `2020-01-01T00:00:00.000Z`
- **UTC timezone**: `TZ=UTC`
- **Fake timers**: Jest fake timers enabled
- **Test seed**: `12345` (consistent random behavior)

### Test Isolation
- Mocks are automatically cleared between tests
- Console warnings are suppressed unless specifically needed
- Module state is reset to prevent bleeding between tests

## Writing Tests

### Test Structure
```typescript
import { YourModule } from '@/path/to/module';
import { createSmartAIMock, getTestParams, suppressConsoleWarnings } from './test-utils';

// Mock external dependencies
jest.mock('@/ai/litellm', () => ({
  ai: { generate: jest.fn() }
}));

describe('YourModule', () => {
  // Suppress console warnings for cleaner test output
  suppressConsoleWarnings();

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup mocks as needed
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test implementation
    });

    it('should handle edge cases', () => {
      // Test null, undefined, empty, invalid inputs
    });

    it('should handle errors', () => {
      // Test error conditions and exceptions
    });
  });
});
```

### Test Patterns

#### Using Test Utils
```typescript
// For AI-dependent tests
const params = getTestParams();
const result = await someAIFunction(input, params.apiKey, params.model, params.apiBase);

// For smart AI mocking
(require('@/ai/litellm').ai.generate as jest.Mock).mockImplementation(createSmartAIMock());
```

#### Edge Cases to Test
- `null` and `undefined` inputs
- Empty strings, arrays, objects
- Maximum/minimum values
- Invalid/malformed data
- Network timeouts and errors
- Authentication failures
- Rate limiting scenarios

#### Error Path Testing
```typescript
it('should handle API errors gracefully', async () => {
  mockAPI.mockRejectedValueOnce(new Error('API Error'));
  
  await expect(yourFunction()).rejects.toThrow('API Error');
});

it('should validate input parameters', () => {
  expect(() => yourFunction(null)).toThrow('Parameter required');
  expect(() => yourFunction('')).toThrow('Parameter cannot be empty');
});
```

### Async Testing
```typescript
// Proper async testing
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// Testing promises
it('should resolve with correct data', async () => {
  await expect(promiseFunction()).resolves.toEqual(expectedData);
});

// Testing rejections
it('should reject with error', async () => {
  await expect(failingFunction()).rejects.toThrow('Expected error');
});
```

## Mock Strategies

### AI Service Mocking
Use the smart AI mock for consistent responses:
```typescript
(require('@/ai/litellm').ai.generate as jest.Mock).mockImplementation(createSmartAIMock());
```

### Custom Mocks
```typescript
// Mock external services
jest.mock('@/services/external-service', () => ({
  ExternalService: {
    fetch: jest.fn().mockResolvedValue(mockData)
  }
}));

// Mock with implementation
jest.mock('@/lib/utility', () => ({
  utilityFunction: jest.fn((input) => `mocked-${input}`)
}));
```

### Network Mocking
For HTTP requests, use mocks instead of real network calls:
```typescript
// Mock fetch or axios
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => mockResponse
});
```

## Performance Testing

### Test Speed Requirements
- Individual tests: < 2 seconds
- Full test suite: < 30 seconds
- Investigate any test > 5 seconds

### Speed Optimization
```typescript
// Use focused tests during development
it.only('should test specific functionality', () => {
  // Test implementation
});

// Skip slow tests when not needed
it.skip('should run slow integration test', () => {
  // Slow test
});

// Use beforeAll for expensive setup
describe('Module', () => {
  beforeAll(async () => {
    // Expensive setup once
  });
});
```

## Mutation Testing

### Setup StrykerJS
```bash
# Install Stryker
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner @stryker-mutator/typescript-checker

# Initialize configuration
npx stryker init
```

### Running Mutation Tests
```bash
# Run mutation testing
npx stryker run

# Target specific files
npx stryker run --mutate="src/lib/**/*.ts"

# Generate HTML report
npx stryker run --reporters=html,dashboard
```

### Mutation Score Targets
- **Initial target**: ≥ 60% mutation score
- **Critical modules**: ≥ 80% mutation score
- **Long-term goal**: ≥ 90% mutation score

## Debugging Tests

### Debugging Failed Tests
```bash
# Run single test file with verbose output
npm test -- --testPathPatterns="failing-test.ts" --verbose

# Run with additional logging
DEBUG=* npm test -- --testPathPatterns="failing-test.ts"

# Run without coverage for faster debugging
npm test -- --testPathPatterns="failing-test.ts" --no-coverage
```

### Common Issues
1. **Time-dependent tests**: Use fake timers and fixed dates
2. **Race conditions**: Use `--runInBand` flag
3. **Mock leakage**: Ensure `jest.clearAllMocks()` in beforeEach
4. **Async not awaited**: Always await async operations
5. **Console noise**: Use `suppressConsoleWarnings()` helper

## Test Categories

### Unit Tests
- Test individual functions and methods
- Mock all external dependencies
- Fast execution (< 100ms per test)

### Integration Tests
- Test interaction between modules
- Use minimal mocking
- Moderate execution time (< 2s per test)

### System Tests
- Test complete workflows
- Minimal mocking, closer to real usage
- Slower execution but comprehensive

## Continuous Integration

### Local Validation
Before committing, run:
```bash
# Full validation suite
npm run lint
npm run typecheck
npm test -- --coverage
npm run build
```

### CI Pipeline Order
1. **Lint**: ESLint with max 0 warnings
2. **Type Check**: TypeScript compilation
3. **Unit Tests**: Fast, isolated tests
4. **Integration Tests**: Cross-module tests
5. **Coverage Check**: Enforce thresholds
6. **Build**: Ensure application builds

### Flake Detection
```bash
# Run tests 50 times to detect flakes
for i in {1..50}; do 
  echo "Run $i"
  npm test -- --silent || break
done
```

## Best Practices

### DO
- ✅ Write tests before fixing bugs
- ✅ Use descriptive test names
- ✅ Test edge cases and error conditions
- ✅ Keep tests isolated and deterministic
- ✅ Use appropriate mocking strategies
- ✅ Maintain high coverage on critical code

### DON'T
- ❌ Skip tests to make CI pass
- ❌ Use `.only()` or `.skip()` in committed code
- ❌ Make real network calls in tests
- ❌ Use `setTimeout` for async testing
- ❌ Test implementation details
- ❌ Write overly complex test setups

## Troubleshooting

### Common Error Messages
- **"Model is required"**: Missing API parameters, use `getTestParams()`
- **"Cannot find module"**: Missing mock setup or import path issue
- **"Timeout exceeded"**: Async operation not properly awaited
- **"Expected X but received Y"**: Check mock implementations

### Getting Help
1. Check this documentation first
2. Look at existing similar tests for patterns
3. Run tests with `--verbose` for more details
4. Use `console.log` sparingly for debugging
5. Consider test isolation issues if intermittent failures

## Examples

See the following files for comprehensive test examples:
- `src/test/library-identifier.test.ts` - Service testing with mocks
- `src/test/context-validator.test.ts` - Complex validation testing
- `src/test/extract-libraries.test.ts` - AI flow testing
- `src/test/markdown-comprehensive.test.ts` - Utility function testing

---

For more details on Jest configuration and advanced features, see [Jest Documentation](https://jestjs.io/docs/getting-started).