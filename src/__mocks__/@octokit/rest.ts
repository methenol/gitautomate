// Mock for @octokit/rest to avoid ES module issues in tests
export const Octokit = jest.fn().mockImplementation(() => ({
  rest: {
    repos: {
      getContent: jest.fn().mockResolvedValue({
        data: {
          content: Buffer.from('Mock README content').toString('base64'),
          encoding: 'base64'
        }
      })
    }
  }
}));