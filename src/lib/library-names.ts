/**
 * Normalisation and validation of library names returned by the extraction model.
 *
 * Kept out of the `'use server'` flow so these pure helpers can be imported (and
 * tested) directly — a server-action module may only export async functions.
 */

/**
 * Turn a model's newline-separated answer into clean, unique library names.
 *
 * Exported because this is the deterministic half of extraction — the part that has
 * to reject the property paths and generic nouns that models sprinkle into the list,
 * and therefore the part worth testing directly.
 */
export function parseLibraryList(outputText: string): string[] {
  const rawLibraries = (outputText ?? '')
    .split('\n')
    .map(line => line.trim())
    // Drop comments, empty lines, and bullet/numbering decoration the model may add.
    .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'))
    .map(line => line.replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, '').trim());

  const libraries = rawLibraries
    .map(lib => normalizeLibraryName(lib))
    .filter(lib => lib && isValidLibraryName(lib));

  return [...new Set(libraries)];
}

/**
 * Normalize library names to standard format
 */
export function normalizeLibraryName(name: string): string {
  const normalized = name.toLowerCase()
    .replace(/^@.*?\//, '') // Remove npm scope (@babel/core -> core)
    .replace(/['"]/g, '') // Remove quotes
    .replace(/\.js$/, '') // Remove .js extension  
    .replace(/\.ts$/, '') // Remove .ts extension
    .replace(/[-_\s]+/g, '-') // Normalize separators to hyphens
    .trim();
  
  // Handle common variations
  const variations: Record<string, string> = {
    'nextjs': 'nextjs',
    'next.js': 'nextjs',
    'next': 'nextjs',
    'nuxtjs': 'nuxtjs', 
    'nuxt.js': 'nuxtjs',
    'nodejs': 'nodejs',
    'node.js': 'nodejs',
    'expressjs': 'express',
    'express.js': 'express',
    'tensorflow.js': 'tensorflow'
  };
  
  return variations[normalized] || normalized;
}

/**
 * Generic words models return when they mistake a code identifier or a directory for a
 * dependency. Fetching documentation for these produced bogus lookups (and DNS errors
 * for invented domains), so they are rejected outright.
 *
 * A few entries here are also real packages (`canvas`, `path`). Excluding them costs a
 * rare missed reference page; including them costs a wrong one on almost every project.
 */
const GENERIC_WORD_DENYLIST = new Set([
  'app', 'application', 'api', 'assets', 'base', 'build', 'canvas', 'class', 'client',
  'code', 'component', 'components', 'config', 'configuration', 'core', 'data',
  'database', 'db', 'dist', 'docs', 'documentation', 'env', 'file', 'files', 'font',
  'fonts', 'framework', 'function', 'handler', 'helper', 'helpers', 'hook', 'hooks',
  'image', 'images', 'index', 'input', 'lib', 'library', 'main', 'method', 'model',
  'models', 'module', 'modules', 'output', 'package', 'packages', 'page', 'pages',
  'path', 'project', 'public', 'renderer', 'repo', 'repository', 'route', 'routes',
  'schema', 'script', 'scripts', 'server', 'service', 'services', 'settings', 'setup',
  'source', 'sprite', 'src', 'state', 'static', 'store', 'style', 'styles', 'system',
  'template', 'test', 'tests', 'theme', 'tool', 'tools', 'type', 'types', 'ui',
  'utility', 'util', 'utils', 'validation', 'view', 'views', 'widget',
]);

/**
 * Check if a string is a valid library name
 */
export function isValidLibraryName(name: string): boolean {
  // Must be reasonable length and format
  if (!/^[a-zA-Z][\w-]{1,30}$/.test(name)) return false;

  // Must be at least 2 characters
  if (name.length < 2) return false;

  // Reject names that contain dots (these are usually property paths, not library names)
  if (name.includes('.')) return false;

  // Reject names with multiple consecutive hyphens or underscores
  if (name.includes('--') || name.includes('__')) return false;

  // Reject generic nouns that name a concept in the codebase, not a dependency.
  if (GENERIC_WORD_DENYLIST.has(name)) return false;

  return true;
}