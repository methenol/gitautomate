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
  // For empty arrays, return a minimal valid response instead of empty string
  if (libraries.length === 0) {
    return { output: '\n' }; // Single newline to indicate valid but empty response
  }
  return {
    output: libraries.join('\n')
  };
}

/**
 * Create mock AI responses based on task content patterns
 */
export function createSmartAIMock() {
  return jest.fn().mockImplementation(({ prompt }: { prompt: string }) => {
    // Extract libraries based on patterns in prompts
    const libraries: string[] = [];
    
    // Handle empty or whitespace-only input
    if (!prompt || prompt.trim().length === 0) {
      return Promise.resolve(createMockAIResponse([]));
    }
    
    // Get the task details section from the prompt (after "Task Details:")
    const taskDetailsMatch = prompt.match(/Task Details:\s*(.*?)(?:\n\nExtract the library names now:|$)/);
    const taskContent = taskDetailsMatch ? taskDetailsMatch[1].toLowerCase() : prompt.toLowerCase();
    
    // Handle empty task content
    if (!taskContent || taskContent.trim().length === 0) {
      return Promise.resolve(createMockAIResponse([]));
    }
    
    // Library mappings with their keywords
    const libraryMappings = {
      'react': ['react'],
      'axios': ['axios'],
      'vue': ['vue'],
      'angular': ['angular'],
      'svelte': ['svelte'],
      'typescript': ['typescript'],
      'express': ['express', 'expressjs'],
      'fastify': ['fastify'],
      'django': ['django'],
      'flask': ['flask'],
      'nodejs': ['nodejs', 'node.js'],
      'mongodb': ['mongodb', 'mongo'],
      'mongoose': ['mongoose'],
      'postgresql': ['postgresql', 'postgres'],
      'redis': ['redis'],
      'mysql': ['mysql'],
      'jest': ['jest'],
      '@testing-library/react': ['@testing-library/react', 'testing-library'],
      'supertest': ['supertest'],
      'mongodb-memory-server': ['mongodb-memory-server'],
      '@types/jest': ['@types/jest'],
      'cypress': ['cypress'],
      'mocha': ['mocha'],
      'docker': ['docker'],
      'kubernetes': ['kubernetes', 'k8s'],
      'nginx': ['nginx'],
      'webpack': ['webpack'],
      'pygame': ['pygame'],
      'lodash': ['lodash'],
      'moment': ['moment'],
      'redux': ['redux'],
      'tensorflow': ['tensorflow'],
      'react-dom': ['react-dom'],
      'react-router': ['react-router'],
      'react-router-dom': ['react-router-dom'],
      'react-native': ['react-native'],
      'redux-toolkit': ['redux-toolkit'],
      'nextjs': ['next.js', 'nextjs', 'next'],
      'bcryptjs': ['bcryptjs', 'bcrypt'],
      'jsonwebtoken': ['jsonwebtoken', 'jwt'],
      'cors': ['cors'],
      'joi': ['joi'],
      'express-rate-limit': ['express-rate-limit'],
      'tailwindcss': ['tailwindcss', 'tailwind'],
      'vite': ['vite'],
      'validlibrary': ['validlibrary'], // Test library
    };
    
    // Check each library mapping against the task content
    Object.entries(libraryMappings).forEach(([library, keywords]) => {
      if (keywords.some(keyword => taskContent.includes(keyword.toLowerCase()))) {
        libraries.push(library);
      }
    });
    
    // Handle npm install patterns specifically
    if (taskContent.includes('npm install')) {
      const installMatches = taskContent.match(/npm install\s+([\w\s\-@/.]+)/gi);
      if (installMatches) {
        installMatches.forEach(match => {
          const packages = match.replace(/npm install/i, '').trim().split(/\s+/);
          packages.forEach(pkg => {
            const cleanPkg = pkg.replace(/[@\d\.\^~<>=]/g, '').trim();
            if (cleanPkg && cleanPkg.length > 1 && /^[a-zA-Z][\w-]*$/.test(cleanPkg)) {
              libraries.push(cleanPkg);
            }
          });
        });
      }
    }
    
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