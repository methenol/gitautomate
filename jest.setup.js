// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
// import '@testing-library/jest-dom'

// Mock external dependencies that cause ES module issues
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      repos: {
        get: jest.fn().mockResolvedValue({ data: { description: 'Test repo' } }),
        getContent: jest.fn().mockResolvedValue({ data: { content: 'VGVzdCBjb250ZW50' } }),
      },
    },
  })),
}));

jest.mock('cheerio', () => ({
  load: jest.fn().mockReturnValue({
    text: jest.fn().mockReturnValue('Test content'),
    find: jest.fn().mockReturnValue({
      text: jest.fn().mockReturnValue('Test content'),
    }),
  }),
}));

jest.mock('@/ai/litellm', () => ({
  ai: {
    generate: jest.fn(),
  },
}));

// Mock the extractLibraries function globally
jest.mock('@/ai/flows/extract-libraries', () => ({
  extractLibraries: jest.fn().mockImplementation(async ({ taskDetails }) => {
    // Simple pattern-based extraction for testing purposes
    const libraries = new Set();
    
    // Extract from REQUIRED LIBRARIES sections
    const requiredMatch = taskDetails.match(/REQUIRED LIBRARIES:\s*([^\n\r.]+)/gi);
    if (requiredMatch) {
      requiredMatch.forEach((match) => {
        const libList = match.replace(/REQUIRED LIBRARIES:\s*/i, '');
        const libs = libList.split(/[,\s]+/).filter((lib) => lib.trim().length > 0);
        libs.forEach((lib) => {
          const cleanLib = lib.trim().toLowerCase();
          if (isValidLibName(cleanLib)) {
            libraries.add(cleanLib);
          }
        });
      });
    }
    
    // Extract from import statements
    const importMatches = taskDetails.match(/import\s+.*?from\s+['"`]([a-zA-Z][\w\-@/]*?)['"`]/gi);
    if (importMatches) {
      importMatches.forEach((match) => {
        const libMatch = match.match(/['"`]([a-zA-Z][\w\-@/]*?)['"`]/);
        if (libMatch) {
          const cleanLib = libMatch[1].toLowerCase();
          if (isValidLibName(cleanLib)) {
            libraries.add(cleanLib);
          }
        }
      });
    }
    
    // Extract from package manager commands
    const npmMatches = taskDetails.match(/npm\s+install\s+((?:[a-zA-Z][\w-@/]+\s*)+)/gi);
    if (npmMatches) {
      npmMatches.forEach((match) => {
        const packages = match.replace(/npm\s+install\s+/i, '').trim().split(/\s+/);
        packages.forEach((pkg) => {
          const cleanLib = pkg.toLowerCase();
          if (isValidLibName(cleanLib)) {
            libraries.add(cleanLib);
          }
        });
      });
    }
    
    // Extract well-known libraries from context (only exact matches to avoid noise)
    const wellKnownLibs = ['react', 'react-dom', 'react-router-dom', 'vue', 'angular', 'express', 'django', 'flask', 'postgresql', 'redis', 'mongodb', 'mysql', 'jest', 'mocha', 'cypress', 'docker', 'kubernetes', 'nginx', 'typescript', 'javascript', 'python', 'tailwindcss', 'mongoose', 'jsonwebtoken', 'bcryptjs', 'cors', 'axios', 'lodash', 'moment', 'redux', 'tensorflow', 'pygame', 'react-router', 'fastify'];
    wellKnownLibs.forEach(lib => {
      // Use word boundaries for exact matches to avoid partial matches
      const regex = new RegExp(`\\b${lib}\\b`, 'i');
      if (regex.test(taskDetails)) {
        libraries.add(lib);
      }
    });
    
    // Filter function to exclude common non-library words
    function isValidLibName(name) {
      if (!name || name.length < 2 || name.length > 30) return false;
      if (!/^[a-zA-Z][\w-]*$/.test(name)) return false;
      
      // Exclude common words that aren't libraries
      const excludeWords = ['create', 'setup', 'using', 'with', 'components', 'hooks', 'routing', 'build', 'test', 'config', 'utils', 'helper', 'common', 'shared', 'base', 'core', 'main', 'index', 'app', 'src', 'lib'];
      if (excludeWords.includes(name.toLowerCase())) return false;
      
      return true;
    }
    
    return {
      libraries: Array.from(libraries)
    };
  }),
}));