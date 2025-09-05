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