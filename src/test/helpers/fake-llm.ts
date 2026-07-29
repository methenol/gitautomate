/**
 * A test double for the library-extraction LLM.
 *
 * Library extraction runs through a model, so asserting on real model output would make
 * these suites a network test of someone else's weights. Instead this stub behaves like
 * a plausible-but-imperfect model: it picks up the obvious signals in the prompt
 * (explicit "REQUIRED LIBRARIES" lists, install commands, imports, known package names)
 * and — importantly — also returns the property paths and generic nouns a real model
 * leaks. That leaves our own normalisation, denylist and dedupe logic as the thing
 * actually under test.
 */

/** Package names the stub recognises when they are merely mentioned in prose. */
const KNOWN_PACKAGES = [
  '@testing-library/react', '@types/jest', '@types/node', 'angular', 'axios', 'babel',
  'bcryptjs', 'cheerio', 'cors', 'cypress', 'django', 'docker', 'express',
  'express-rate-limit', 'fastify', 'flask', 'jest', 'joi', 'jsonwebtoken',
  'kubernetes', 'lodash', 'mocha', 'mongodb', 'mongodb-memory-server', 'mongoose',
  'moment', 'next.js', 'numpy', 'postgresql', 'pygame', 'react', 'react-dom',
  'react-router', 'react-router-dom', 'redis', 'redux', 'sequelize', 'supertest',
  'svelte', 'tailwindcss', 'tensorflow', 'typescript', 'vue', 'webpack',
];

/** Rough emulation of what a competent extraction model would answer. */
export function fakeExtractLibraries(prompt: string): string {
  const taskText = prompt.split('Task Details:').slice(1).join('Task Details:') || prompt;
  const found: string[] = [];

  const add = (value: string) => {
    const cleaned = value.trim().replace(/^['"`]|['"`;,.]$/g, '');
    if (cleaned && !found.includes(cleaned)) found.push(cleaned);
  };

  // Explicit "REQUIRED LIBRARIES:" declarations win, verbatim — including any junk the
  // author put in the list, which is exactly what the pipeline must filter.
  for (const match of taskText.matchAll(/REQUIRED LIBRARIES:\s*(.+)/gi)) {
    match[1]
      .split(/[,\s]+/)
      .filter((token) => token.length > 0)
      .forEach(add);
  }

  // Install commands.
  for (const match of taskText.matchAll(
    /(?:npm install|npm i|yarn add|pnpm add|pip install)\s+([^\n]+)/gi
  )) {
    match[1]
      .split(/\s+/)
      .filter((token) => token && !token.startsWith('-'))
      .forEach(add);
  }

  // Imports and requires.
  for (const match of taskText.matchAll(/from\s+['"]([^'"]+)['"]/g)) add(match[1]);
  for (const match of taskText.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) add(match[1]);

  // Bare mentions of well-known packages.
  for (const pkg of KNOWN_PACKAGES) {
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^\\w-])${escaped}([^\\w-]|$)`, 'i').test(taskText)) add(pkg);
  }

  // Dotted identifiers a real model routinely mistakes for packages. Kept so the
  // rejection of property paths stays under test rather than assumed.
  for (const match of taskText.matchAll(/\b([a-z][\w]*(?:\.[a-z_][\w]*){1,3})\b/gi)) {
    if (!/\.(js|ts|tsx|jsx|py|md|json|yml|yaml|html|css)$/i.test(match[1])) add(match[1]);
  }

  return found.join('\n');
}

/**
 * Install the stub on a jest-mocked `@/ai/litellm`.
 * The suite must still call `jest.mock('@/ai/litellm')` at module scope.
 */
export function installFakeExtractionLLM(generate: jest.Mock): void {
  generate.mockImplementation(async ({ prompt }: { prompt: string }) => ({
    output: fakeExtractLibraries(prompt),
  }));
}
