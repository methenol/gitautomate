/**
 * Frontmatter must survive the markdown fixers untouched — a mangled block breaks
 * the machine-readable half of every task file.
 */
import {
  parseFrontmatter,
  preserveFrontmatter,
  stringifyFrontmatter,
  withFrontmatter,
} from '@/lib/frontmatter';
import { BrowserMarkdownLinter } from '@/lib/browser-markdown-linter';
import { formatTaskMarkdown } from '@/lib/markdown';

describe('parseFrontmatter', () => {
  it('parses scalars and flow arrays', () => {
    const { frontmatter, body, hasFrontmatter } = parseFrontmatter(
      `---\nid: T-003\ntitle: "Implement: the store"\ndepends_on: [T-001, T-002]\nstatus: pending\norder: 3\ndone: false\n---\n\n# T-003 — Implement the store\n`
    );

    expect(hasFrontmatter).toBe(true);
    expect(frontmatter.id).toBe('T-003');
    expect(frontmatter.title).toBe('Implement: the store');
    expect(frontmatter.depends_on).toEqual(['T-001', 'T-002']);
    expect(frontmatter.order).toBe(3);
    expect(frontmatter.done).toBe(false);
    expect(body.trim()).toBe('# T-003 — Implement the store');
  });

  it('treats an empty array as empty', () => {
    expect(parseFrontmatter('---\ndepends_on: []\n---\n\nbody\n').frontmatter.depends_on).toEqual([]);
  });

  it('reports no frontmatter for a plain document', () => {
    const result = parseFrontmatter('# Title\n\nSome --- text\n');
    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe('# Title\n\nSome --- text\n');
  });

  it('round-trips through stringify', () => {
    const frontmatter = { id: 'T-001', depends_on: ['T-000'], status: 'pending' };
    const parsed = parseFrontmatter(`${stringifyFrontmatter(frontmatter)}body\n`);
    expect(parsed.frontmatter).toEqual(frontmatter);
  });
});

describe('withFrontmatter', () => {
  it('replaces existing keys and keeps unknown ones', () => {
    const result = withFrontmatter('---\nid: T-001\nowner: alice\n---\n\nbody\n', {
      id: 'T-002',
      status: 'pending',
    });

    const { frontmatter, body } = parseFrontmatter(result);
    expect(frontmatter).toEqual({ id: 'T-002', owner: 'alice', status: 'pending' });
    expect(body.trim()).toBe('body');
  });
});

describe('preserveFrontmatter', () => {
  it('leaves the block untouched while transforming the body', () => {
    const result = preserveFrontmatter('---\nid: T-001\n---\n\nbody\n', () => 'CHANGED\n');
    expect(result).toBe('---\nid: T-001\n---\n\nCHANGED\n');
  });
});

describe('markdown fixers on documents with frontmatter', () => {
  const document = `---\nid: T-004\ntitle: Add the session store\ndepends_on: [T-001]\nstatus: pending\n---\n\n# T-004 — Add the session store\n\n## Objective\n\nSessions survive a restart.\n`;

  it('does not corrupt the block in the browser linter', () => {
    const fixed = BrowserMarkdownLinter.getFixedContent(document, 'task-004.md');
    const { frontmatter, hasFrontmatter } = parseFrontmatter(fixed);

    expect(hasFrontmatter).toBe(true);
    expect(frontmatter.id).toBe('T-004');
    expect(frontmatter.depends_on).toEqual(['T-001']);
    expect(fixed).not.toMatch(/^---\n\n/);
  });

  it('does not corrupt the block in formatTaskMarkdown', () => {
    const formatted = formatTaskMarkdown(document);
    expect(parseFrontmatter(formatted).frontmatter.id).toBe('T-004');
    expect(formatted).toContain('# T-004 — Add the session store');
  });
});
