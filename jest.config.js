const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@octokit/rest$': '<rootDir>/__mocks__//@octokit/rest.js',
    '^cheerio$': '<rootDir>/__mocks__/cheerio.js',
  },
  testTimeout: 30000,
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.json'
    }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/*.tsx', // Exclude Next.js app components from coverage requirements
    '!src/components/**/*.tsx', // Exclude UI components from coverage requirements
    '!src/hooks/**/*.tsx', // Exclude hooks from coverage requirements
  ],
  transformIgnorePatterns: [
    'node_modules'
  ],
  clearMocks: true,
  automock: false,
  preset: 'ts-jest/presets/default-esm',
  // Coverage thresholds as required by issue #46
  coverageThreshold: {
    global: {
      lines: 85,
      branches: 80,
      functions: 85,
      statements: 85,
    },
    // Critical modules - reduced thresholds initially
    'src/ai/flows/extract-libraries.ts': {
      lines: 90,
      branches: 80,
      functions: 90,
      statements: 90,
    },
    'src/ai/validation/context-validator.ts': {
      lines: 90,
      branches: 80,
      functions: 90,
      statements: 90,
    },
    'src/lib/markdown.ts': {
      lines: 90,
      branches: 85,
      functions: 90,
      statements: 90,
    },
    'src/lib/browser-markdown-linter.ts': {
      lines: 90,
      branches: 85,
      functions: 90,
      statements: 90,
    },
    'src/services/library-identifier.ts': {
      lines: 90,
      branches: 85,
      functions: 90,
      statements: 90,
    }
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)