/**
 * Minimal, dependency-free YAML frontmatter support.
 *
 * Task files carry frontmatter so an orchestrating agent can read `id`,
 * `depends_on`, and `status` without parsing prose. We only need scalars and
 * flow-style arrays, so a tiny hand-rolled parser beats pulling in a YAML
 * dependency that also has to work in the browser bundle.
 */

export type FrontmatterValue = string | number | boolean | string[];
export type Frontmatter = Record<string, FrontmatterValue>;

export interface ParsedDocument {
  frontmatter: Frontmatter;
  /** Document body with the frontmatter block removed. */
  body: string;
  /** True when a well-formed frontmatter block was present. */
  hasFrontmatter: boolean;
}

const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function coerce(raw: string): FrontmatterValue {
  const value = raw.trim();

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((item) => unquote(item.trim()))
      .filter((item) => item.length > 0);
  }

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value);

  return unquote(value);
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
    (value.startsWith("'") && value.endsWith("'") && value.length > 1)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** Split a document into frontmatter and body. Never throws. */
export function parseFrontmatter(content: string): ParsedDocument {
  const source = (content ?? '').replace(/^\uFEFF/, '');
  const match = source.match(FRONTMATTER_PATTERN);

  if (!match) {
    return { frontmatter: {}, body: source, hasFrontmatter: false };
  }

  const frontmatter: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf(':');
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    frontmatter[key] = coerce(trimmed.slice(separator + 1));
  }

  return {
    frontmatter,
    body: source.slice(match[0].length),
    hasFrontmatter: true,
  };
}

function serialiseValue(value: FrontmatterValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => quoteIfNeeded(item)).join(', ')}]`;
  }
  if (typeof value === 'string') {
    return quoteIfNeeded(value);
  }
  return String(value);
}

function quoteIfNeeded(value: string): string {
  const needsQuotes = /[:#,[\]{}&*!|>%@`"']|^\s|\s$|^$/.test(value);
  return needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/** Render a frontmatter block (including delimiters and trailing blank line). */
export function stringifyFrontmatter(frontmatter: Frontmatter): string {
  const lines = Object.entries(frontmatter)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}: ${serialiseValue(value)}`);

  if (lines.length === 0) return '';
  return `---\n${lines.join('\n')}\n---\n\n`;
}

/**
 * Attach or replace a document's frontmatter, preserving the body untouched.
 * Existing keys are overwritten by `frontmatter`; unknown existing keys survive.
 */
export function withFrontmatter(content: string, frontmatter: Frontmatter): string {
  const parsed = parseFrontmatter(content);
  const merged = { ...parsed.frontmatter, ...frontmatter };
  return `${stringifyFrontmatter(merged)}${parsed.body.replace(/^\n+/, '')}`;
}

/**
 * Run a transform over the body only, leaving frontmatter byte-identical.
 *
 * Markdown fixers treat `---` as a horizontal rule and happily insert blank
 * lines inside a frontmatter block, which corrupts it. Every fixer should be
 * wrapped in this.
 */
export function preserveFrontmatter(
  content: string,
  transform: (body: string) => string
): string {
  const parsed = parseFrontmatter(content);
  if (!parsed.hasFrontmatter) {
    return transform(content);
  }

  const block = content.slice(0, content.length - parsed.body.length);
  return `${block.replace(/\n*$/, '\n\n')}${transform(parsed.body).replace(/^\n+/, '')}`;
}

/** Async variant of {@link preserveFrontmatter}. */
export async function preserveFrontmatterAsync(
  content: string,
  transform: (body: string) => Promise<string>
): Promise<string> {
  const parsed = parseFrontmatter(content);
  if (!parsed.hasFrontmatter) {
    return transform(content);
  }

  const block = content.slice(0, content.length - parsed.body.length);
  const body = await transform(parsed.body);
  return `${block.replace(/\n*$/, '\n\n')}${body.replace(/^\n+/, '')}`;
}
