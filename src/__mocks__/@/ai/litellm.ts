// Mock for ai/litellm to avoid dependencies in tests
export const ai = {
  extractLibraryNames: jest.fn().mockResolvedValue({
    libraries: ['react', 'express', 'typescript']
  }),
  enhanceDocumentation: jest.fn().mockResolvedValue({
    content: 'Enhanced documentation content'
  })
};