// Mock for cheerio to avoid ES module issues in tests
export const load = jest.fn().mockReturnValue({
  text: jest.fn().mockReturnValue('Mock cheerio text content'),
  html: jest.fn().mockReturnValue('<div>Mock HTML</div>')
});

export default { load };