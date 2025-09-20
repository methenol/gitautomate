

// Mock cheerio
const mockCheerio = () => ({
  find: jest.fn(),
  text: jest.fn(() => ''),
  attr: jest.fn(() => null),
  html: jest.fn(() => '')
});

module.exports = mockCheerio;

