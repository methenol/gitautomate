/**
 * Common test utilities for consistent test setup and mocking
 */

export const TEST_CONFIG = {
  API_KEY: 'test-api-key-12345',
  MODEL: 'google/gemini-pro',
  API_BASE: 'https://api.google.com/v1',
  TIMEOUT: 30000,
  FIXED_DATE: '2020-01-01T00:00:00.000Z',
} as const;

/**
 * Standard mock response for AI library extraction
 */
export function createMockAIResponse(libraries: string[]): { output: string } {
  return {
    output: libraries.join('\n')
  };
}

/**
 * Create mock AI responses based on task content patterns
 */
export function createSmartAIMock() {
  return jest.fn().mockImplementation(({ prompt }: { prompt: string }) => {
    // Extract libraries based on common patterns in prompts
    const libraries: string[] = [];
    
    // Frontend technologies
    if (prompt.includes('react') || prompt.includes('React')) libraries.push('react');
    if (prompt.includes('vue') || prompt.includes('Vue')) libraries.push('vue');
    if (prompt.includes('angular') || prompt.includes('Angular')) libraries.push('angular');
    if (prompt.includes('typescript') || prompt.includes('TypeScript')) libraries.push('typescript');
    
    // Backend technologies
    if (prompt.includes('express') || prompt.includes('Express')) libraries.push('express');
    if (prompt.includes('django') || prompt.includes('Django')) libraries.push('django');
    if (prompt.includes('flask') || prompt.includes('Flask')) libraries.push('flask');
    if (prompt.includes('nodejs') || prompt.includes('Node.js')) libraries.push('nodejs');
    
    // Databases
    if (prompt.includes('mongodb') || prompt.includes('MongoDB')) libraries.push('mongodb');
    if (prompt.includes('postgresql') || prompt.includes('PostgreSQL')) libraries.push('postgresql');
    if (prompt.includes('redis') || prompt.includes('Redis')) libraries.push('redis');
    if (prompt.includes('mysql') || prompt.includes('MySQL')) libraries.push('mysql');
    
    // Testing
    if (prompt.includes('jest') || prompt.includes('Jest')) libraries.push('jest');
    if (prompt.includes('cypress') || prompt.includes('Cypress')) libraries.push('cypress');
    if (prompt.includes('mocha') || prompt.includes('Mocha')) libraries.push('mocha');
    
    // DevOps/Tools
    if (prompt.includes('docker') || prompt.includes('Docker')) libraries.push('docker');
    if (prompt.includes('webpack') || prompt.includes('Webpack')) libraries.push('webpack');
    if (prompt.includes('axios') || prompt.includes('Axios')) libraries.push('axios');
    
    return Promise.resolve(createMockAIResponse([...new Set(libraries)])); // Remove duplicates
  });
}

/**
 * Standard test parameters for library identification
 */
export function getTestParams() {
  return {
    apiKey: TEST_CONFIG.API_KEY,
    model: TEST_CONFIG.MODEL,
    apiBase: TEST_CONFIG.API_BASE
  };
}

/**
 * Create a mock library object for testing
 */
export function createMockLibrary(name: string, overrides?: Partial<any>) {
  return {
    name,
    confidenceScore: 0.9,
    category: 'library',
    detectedIn: ['test-task'],
    source: 'llm' as const,
    ...overrides
  };
}

/**
 * Suppress console warnings during test execution
 */
export function suppressConsoleWarnings() {
  const originalWarn = console.warn;
  beforeEach(() => {
    console.warn = jest.fn();
  });
  afterEach(() => {
    console.warn = originalWarn;
  });
}