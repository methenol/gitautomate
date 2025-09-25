# Testing Guide

This document provides comprehensive guidelines for testing the GitAutomate application, following the requirements from issue #46.

## Quick Setup (3 Commands)

```bash
npm ci                    # Clean install with lockfile
npm run test:coverage     # Run tests with coverage
npm run lint             # Validate code quality
```

## Test Infrastructure

### Test Runner & Environment
- **Test Runner**: Jest with coverage via istanbul
- **TypeScript**: Full support with strict mode enabled
- **Deterministic Environment**: Fixed seed `12345`, frozen time `2020-01-01T00:00:00.000Z`, UTC timezone

### Coverage Thresholds (Enforced)
- **Lines**: ≥85%
- **Branches**: ≥80% 
- **Functions**: ≥85%
- **Statements**: ≥85%

## Commands Reference

### Fast Commands (Development)
```bash
# Watch mode for active development
npm run test:watch

# Run specific test file
npm test -- basic-validation.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should handle"

# Skip slow tests during development
npm test -- --passWithNoTests
```

### Full Commands (CI/Production)
```bash
# Complete test suite with coverage
npm run test:coverage

# CI mode (verbose, no cache, in band)
npm run test:ci

# Coverage in different formats
npm run coverage:html     # HTML report in coverage/
npm run coverage:text     # Text summary to console
npm run coverage:json     # JSON report for tools
```

### Coverage & Quality Commands
```bash
# Coverage validation
npm run test:coverage
npm run coverage:check    # Enforce thresholds

# Code quality
npm run lint              # ESLint validation
npm run typecheck         # TypeScript validation
npm run pre-commit        # Full validation suite

# Mutation testing (advanced quality validation)
npm run mutation          # Full mutation testing
npm run mutation:lib      # Library-focused testing
npm run mutation:services # Services-focused testing
```

## Test Environment Configuration

### Deterministic Behavior
All tests run in a fully deterministic environment:

- **Global Seed**: `12345` for reproducible randomness
- **Time Frozen**: `2020-01-01T00:00:00.000Z` for consistent timestamps
- **Timezone**: `TZ=UTC` and `LANG=C` for locale consistency
- **Fake Timers**: Jest modern fake timers enabled

### Environment Variables
```bash
# Test environment variables
TZ=UTC                    # Timezone consistency
LANG=C                   # Locale consistency  
JEST_SEED=12345          # Random seed (optional override)
CI=true                  # CI mode detection
```

## Writing Tests

### Test Structure Patterns

#### Smart AI Mocking
```typescript
import { ai } from '@/ai/litellm';

jest.mock('@/ai/litellm', () => ({
  ai: { generate: jest.fn() }
}));

const mockAI = ai as jest.Mocked<typeof ai>;

beforeEach(() => {
  mockAI.generate.mockImplementation(async ({ prompt }) => {
    // Context-aware responses based on prompt content
    if (prompt.includes('architecture')) {
      return { output: 'React Architecture with components...' };
    }
    if (prompt.includes('tasks')) {
      return { output: 'Task 1: Setup\nTask 2: Implementation...' };
    }
    return { output: 'Generic response' };
  });
});
```

#### Test Parameter Utilities
```typescript
// Use standardized test parameters
const getTestParams = () => ({
  apiKey: 'test-api-key-12345',
  model: 'google/gemini-pro',
  apiBase: 'https://api.google.com/v1'
});

// In tests
const params = getTestParams();
const result = await someFunction(input, params.apiKey, params.model, params.apiBase);
```

#### Comprehensive Error Testing
```typescript
describe('Error Scenarios', () => {
  it('should handle API failures', async () => {
    mockAI.generate.mockRejectedValue(new Error('API unavailable'));
    
    await expect(someFunction()).rejects.toThrow('API unavailable');
  });

  it('should handle malformed responses', async () => {
    mockAI.generate.mockResolvedValue({ output: 'invalid-format' });
    
    const result = await someFunction();
    expect(result).toHaveProperty('error');
  });

  it('should handle empty responses', async () => {
    mockAI.generate.mockResolvedValue({ output: '' });
    
    const result = await someFunction();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});
```

### Edge Cases Coverage

#### Boundary Values
```typescript
describe('Edge Cases', () => {
  it('should handle null and undefined', async () => {
    expect(() => someFunction(null)).not.toThrow();
    expect(() => someFunction(undefined)).not.toThrow();
  });

  it('should handle empty inputs', async () => {
    const result = await someFunction('', [], {});
    expect(result).toBeDefined();
  });

  it('should handle very large inputs', async () => {
    const largeInput = 'data '.repeat(10000);
    const result = await someFunction(largeInput);
    expect(result).toBeDefined();
  });
});
```

#### Configuration Testing
```typescript
describe('Configuration Variations', () => {
  it.each([
    ['gpt-4', 0.7, 'https://api.openai.com/v1'],
    ['gemini-pro', 0.3, 'https://api.google.com/v1'],
    ['claude-3', 1.0, 'https://api.anthropic.com/v1'],
  ])('should work with %s model, temp %f, base %s', async (model, temp, base) => {
    const result = await someFunction(input, 'key', model, base, false, temp);
    expect(result).toBeDefined();
  });
});
```

### Integration Testing

#### Cross-Module Workflows
```typescript
describe('Integration Workflows', () => {
  it('should handle complete PRD to tasks workflow', async () => {
    // 1. Generate architecture
    const architecture = await generateArchitecture(prd);
    expect(architecture.content).toBeTruthy();

    // 2. Generate specifications  
    const specs = await generateSpecifications(prd, architecture);
    expect(specs.content).toBeTruthy();

    // 3. Generate file structure
    const fileStructure = await generateFileStructure(prd, architecture, specs);
    expect(fileStructure.content).toBeTruthy();

    // 4. Generate tasks
    const tasks = await generateTasks({ 
      architecture: architecture.content,
      specifications: specs.content,
      fileStructure: fileStructure.content
    });
    expect(tasks.tasks.length).toBeGreaterThan(0);
  });
});
```

## Mock Strategies

### External Services
```typescript
// File system operations
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('mock content'),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

// HTTP requests
jest.mock('node-fetch', () => jest.fn());
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

mockFetch.mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'mock response' }),
} as Response);
```

### GitHub API
```typescript
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => ({
    repos: {
      createUsingTemplate: jest.fn().mockResolvedValue({ data: { id: 123 } }),
      getContent: jest.fn().mockResolvedValue({ data: { content: 'base64content' } }),
    },
    issues: {
      create: jest.fn().mockResolvedValue({ data: { number: 1 } }),
    },
  })),
}));
```

## Performance Testing

### Timing Constraints
- Each test should complete in <2 seconds
- Full test suite should complete in <120 seconds
- Memory usage should remain stable during test runs

### Benchmarking Pattern
```typescript
describe('Performance', () => {
  it('should complete within time limits', async () => {
    const startTime = Date.now();
    
    await someFunction(largeInput);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(2000); // 2 seconds max
  });

  it('should handle concurrent operations', async () => {
    const operations = Array(100).fill(null).map(() => someFunction(input));
    
    const results = await Promise.all(operations);
    expect(results).toHaveLength(100);
  });
});
```

## Debugging Tests

### Common Issues

#### Test Isolation Problems
```typescript
// Problem: Tests affecting each other
beforeEach(() => {
  jest.clearAllMocks();           // Clear mock call history
  jest.resetModules();            // Reset module registry (when needed)
  
  // Reset any global state
  globalState.reset();
});
```

#### Timing Issues  
```typescript
// Problem: Tests dependent on real time
// Solution: Use fake timers and advance manually
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

// In test
jest.advanceTimersByTime(1000); // Advance by 1 second
```

#### Async Issues
```typescript
// Problem: Missing awaits
// Solution: Proper async/await patterns
it('should handle async operations', async () => {
  const promise = someAsyncFunction();
  
  // Wait for all pending promises
  await act(async () => {
    await promise;
  });
  
  expect(result).toBeDefined();
});
```

### Debug Commands
```bash
# Run tests in debug mode
npm test -- --verbose --no-cache

# Run single test with full output  
npm test -- --testNamePattern="specific test" --verbose

# Check test coverage for specific file
npm test -- --collectCoverageFrom="src/specific-file.ts" --coverage
```

## Mutation Testing

### StrykerJS Configuration
Mutation testing is configured to target critical modules:

```bash
# Run mutation testing on core modules
npm run mutation

# Target specific areas
npm run mutation:lib      # Library utilities
npm run mutation:services # Business logic services
```

### Mutation Score Targets
- **High Quality Modules**: ≥80% mutation score
- **Standard Modules**: ≥60% mutation score  
- **Break Threshold**: <50% mutation score fails build

## CI/CD Integration

### Pipeline Order
1. **Lint**: Code style and basic error checking
2. **TypeCheck**: TypeScript compilation validation
3. **Build**: Application build verification
4. **Test**: Full test suite with coverage

### Coverage Enforcement
Jest is configured to fail CI if coverage drops below thresholds:
```json
{
  "coverageThreshold": {
    "global": {
      "lines": 85,
      "branches": 80,
      "functions": 85,
      "statements": 85
    }
  }
}
```

## Troubleshooting

### Common Test Failures

#### "Model is required" Errors
```typescript
// Problem: Missing required parameters in function calls
// Solution: Use standardized test parameters
const params = getTestParams();
await someFunction(input, params.apiKey, params.model, params.apiBase);
```

#### Snapshot Mismatches
```typescript
// Problem: Snapshots not matching due to timing/randomness  
// Solution: Use deterministic values
expect(result).toMatchObject({
  timestamp: '2020-01-01T00:00:00.000Z', // Fixed time
  id: expect.stringMatching(/^[a-f0-9-]+$/), // Pattern instead of exact
});
```

#### Memory Leaks in Tests
```typescript
// Problem: Memory usage growing during test runs
// Solution: Proper cleanup
afterEach(() => {
  jest.clearAllMocks();
  // Clear any module-level caches
  delete require.cache[require.resolve('../some-module')];
});
```

### Getting Help

1. **Check test logs**: Run with `--verbose` for detailed output
2. **Isolate failing tests**: Run single test files to identify issues  
3. **Verify mocks**: Ensure all external dependencies are properly mocked
4. **Check determinism**: Verify tests pass consistently with fixed seed

## Best Practices Summary

✅ **Always use proper async/await patterns**  
✅ **Mock all external dependencies**  
✅ **Test edge cases and error paths**  
✅ **Keep tests isolated and deterministic**  
✅ **Use descriptive test names**  
✅ **Follow the AAA pattern: Arrange, Act, Assert**  
✅ **Maintain high coverage without sacrificing quality**  
✅ **Write tests that document expected behavior**

This testing infrastructure ensures reliable, fast, and comprehensive validation of the GitAutomate application following all requirements from issue #46.