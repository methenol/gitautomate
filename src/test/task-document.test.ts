/**
 * The task-document contract. These rules are what make an exported file safe to
 * hand to an agent as its entire prompt, so they are enforced identically at
 * generation time and after a user edits a task in the UI.
 */
import {
  assembleTaskDocument,
  blockingIssues,
  extractSection,
  hasSection,
  validateTaskDocument,
} from '@/lib/task-document';
import { parseFrontmatter } from '@/lib/frontmatter';
import { parseQualityGates } from '@/lib/quality-gates';

const GATES = parseQualityGates('```gates\nlint: npm run lint\ntest: npm test\n```');

const GOOD_BODY = `# T-004 — Implement the session store

## Objective

Sessions persist across a server restart.

## Context

The session store sits behind the auth service described in the architecture and
satisfies \`FR-3\` and \`NFR-2\`. It unblocks every authenticated route.

## Preconditions

- [ ] T-001 and T-002 are merged.
- [ ] The test suite passes on a clean checkout.

## Scope

### In scope

- The session store module and its tests.

### Out of scope

- Token rotation, which belongs to T-007.
- Any change to \`src/api/routes.ts\`.

## Files

| Path | Action | Purpose |
| --- | --- | --- |
| \`src/auth/session.ts\` | create | Session persistence. |
| \`tests/auth/session.test.ts\` | create | Session tests. |

## Interfaces And Contracts

\`\`\`ts
export interface Session { id: string; userId: string; expiresAt: Date }
export function createSession(userId: string): Promise<Session>;
\`\`\`

## Implementation Steps

1. Create \`src/auth/session.ts\` exporting \`createSession\`.
2. Persist sessions through the storage adapter from T-002.
3. Wire the module into the auth service export barrel.

## Testing Requirements

- \`tests/auth/session.test.ts\`: a session round-trips through storage.
- \`tests/auth/session.test.ts\`: an expired session is rejected with \`SessionExpired\`.

## Required Libraries

None.

## Documentation

- Storage adapter API in \`reference/storage/README.md\`.

## Acceptance Criteria

- [ ] \`createSession\` is exported from \`src/auth/session.ts\`.
- [ ] \`npm test\` passes with the new cases in \`tests/auth/session.test.ts\`.
- [ ] An expired session returns \`SessionExpired\` rather than throwing.
- [ ] Restarting the server preserves an active session id.
`;

describe('section helpers', () => {
  it('finds sections case-insensitively and tolerates trailing words', () => {
    expect(hasSection(GOOD_BODY, 'Files')).toBe(true);
    expect(hasSection('## implementation steps (TDD)', 'Implementation Steps')).toBe(true);
    expect(hasSection(GOOD_BODY, 'Quality Gates')).toBe(false);
  });

  it('extracts a section body up to the next heading', () => {
    expect(extractSection(GOOD_BODY, 'Objective')).toBe('Sessions persist across a server restart.');
    expect(extractSection(GOOD_BODY, 'Required Libraries')).toBe('None.');
  });
});

describe('validateTaskDocument', () => {
  it('accepts a document that satisfies the contract', () => {
    expect(validateTaskDocument(GOOD_BODY, { taskId: 'T-004' })).toEqual([]);
  });

  it('requires the appended sections when asked', () => {
    const issues = validateTaskDocument(GOOD_BODY, { requireAppendedSections: true });
    expect(blockingIssues(issues).join(' ')).toContain('Quality Gates');
  });

  it('reports missing sections', () => {
    const issues = blockingIssues(validateTaskDocument(GOOD_BODY.replace('## Preconditions', '## Prerequisites')));
    expect(issues.join(' ')).toContain('"## Preconditions"');
  });

  it('rejects a mismatched task id in the H1', () => {
    const issues = blockingIssues(validateTaskDocument(GOOD_BODY, { taskId: 'T-009' }));
    expect(issues.join(' ')).toContain('T-009');
  });

  it('requires explicit out-of-scope guardrails', () => {
    const issues = blockingIssues(
      validateTaskDocument(GOOD_BODY.replace('### Out of scope', '### Other notes'))
    );
    expect(issues.join(' ')).toContain('Out of scope');
  });

  it('requires enough verifiable acceptance criteria', () => {
    const thin = GOOD_BODY.replace(
      /## Acceptance Criteria[\s\S]*$/,
      '## Acceptance Criteria\n\n- [ ] `createSession` is exported.\n'
    );
    expect(blockingIssues(validateTaskDocument(thin)).join(' ')).toContain('checkbox item');
  });

  it('rejects unverifiable acceptance criteria', () => {
    const vague = GOOD_BODY.replace(
      /## Acceptance Criteria[\s\S]*$/,
      '## Acceptance Criteria\n\n- [ ] The code is clean.\n- [ ] It works properly.\n- [ ] It is robust.\n- [ ] Everything is correctly handled.\n'
    );
    const issues = validateTaskDocument(vague);
    expect(blockingIssues(issues).join(' ')).toContain('verifiable');
    expect(issues.some((issue) => issue.severity === 'warning' && issue.message.includes('subjective'))).toBe(true);
  });

  it('rejects template leftovers and hedging in prose', () => {
    const leaky = GOOD_BODY.replace('Sessions persist across a server restart.', 'TODO: decide this later.');
    expect(blockingIssues(leaky ? validateTaskDocument(leaky) : []).join(' ')).toContain('TBD/TODO');

    const hedged = GOOD_BODY.replace('Session persistence.', 'Handle storage as appropriate.');
    expect(blockingIssues(validateTaskDocument(hedged)).join(' ')).toContain('as appropriate');
  });

  it('does not mistake code braces for template placeholders', () => {
    expect(validateTaskDocument(GOOD_BODY, { taskId: 'T-004' })).toEqual([]);
  });

  it('warns when a code block is long enough to be an implementation', () => {
    const bloated = GOOD_BODY.replace(
      '## Implementation Steps',
      `## Notes\n\n\`\`\`ts\n${Array.from({ length: 30 }, (_, index) => `const line${index} = ${index};`).join('\n')}\n\`\`\`\n\n## Implementation Steps`
    );
    expect(validateTaskDocument(bloated).some((issue) => issue.message.includes('25 lines'))).toBe(true);
  });

  it('reports an empty document once, without crashing', () => {
    expect(validateTaskDocument('')).toEqual([{ severity: 'error', message: 'The document is empty.' }]);
  });
});

describe('assembleTaskDocument', () => {
  const assembled = assembleTaskDocument({
    taskId: 'T-004',
    title: 'Implement the session store',
    body: GOOD_BODY,
    dependsOn: ['T-001', 'T-002'],
    files: ['src/auth/session.ts'],
    gates: GATES,
    useTDD: true,
  });

  it('adds frontmatter an orchestrator can read', () => {
    const { frontmatter } = parseFrontmatter(assembled);
    expect(frontmatter.id).toBe('T-004');
    expect(frontmatter.depends_on).toEqual(['T-001', 'T-002']);
    expect(frontmatter.status).toBe('pending');
    expect(frontmatter.gates).toEqual(['lint', 'test']);
  });

  it('appends the project gates verbatim rather than per-task inventions', () => {
    expect(assembled).toContain('- [ ] `npm run lint` exits zero');
    expect(assembled).toContain('- [ ] `npm test` exits zero');
    expect(assembled).toContain('never weaken the gate');
  });

  it('appends a definition of done, TDD clause and a blocked protocol', () => {
    expect(assembled).toContain('## Definition Of Done');
    expect(assembled).toContain('Red → Green → Refactor');
    expect(assembled).toContain('## If You Cannot Finish');
  });

  it('satisfies the full contract it was assembled against', () => {
    const issues = validateTaskDocument(assembled, {
      taskId: 'T-004',
      requireAppendedSections: true,
    });
    expect(blockingIssues(issues)).toEqual([]);
  });

  it('normalises the H1 to the canonical id and title', () => {
    const renamed = assembleTaskDocument({
      taskId: 'T-004',
      title: 'Implement the session store',
      body: GOOD_BODY.replace('# T-004 — Implement the session store', '# Session store work'),
      gates: GATES,
    });
    expect(renamed).toContain('# T-004 — Implement the session store');
    expect(renamed).not.toContain('# Session store work');
  });

  it('omits the TDD clause when TDD is off', () => {
    const standard = assembleTaskDocument({
      taskId: 'T-004',
      title: 'Implement the session store',
      body: GOOD_BODY,
      gates: GATES,
    });
    expect(standard).not.toContain('Red → Green → Refactor');
  });
});
