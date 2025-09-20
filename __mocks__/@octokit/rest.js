


// Mock @octokit/rest
const mockOctokit = {
  plugins: [],
  hook: {
    wrap: jest.fn(),
    before: jest.fn()
  }
};

const Octokit = jest.fn(() => mockOctokit);

module.exports = { Octokit };


