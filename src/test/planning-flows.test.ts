/**
 * End-to-end checks of the two flows that decide what an agent is handed: the planner
 * and the per-task brief. The model is stubbed, so what is under test is the prompt
 * contract, the parsing, the repair loop and the assembly.
 */
import { generateTasks } from '@/ai/flows/generate-tasks';
import { researchTask } from '@/ai/flows/research-task';
import { ai } from '@/ai/litellm';
import { parseFrontmatter } from '@/lib/frontmatter';
import { blockingIssues, validateTaskDocument } from '@/lib/task-document';

jest.mock('@/ai/litellm', () => ({ ai: { generate: jest.fn() } }));

// Linting spawns markdownlint via npx; keep these tests hermetic and fast.
jest.mock('@/services/markdown-linter', () => ({
  MarkdownLinter: { lintAndFix: jest.fn(async () => ({ isValid: true, errors: [] })) },
}));

const generate = ai.generate as unknown as jest.Mock;

const STANDARDS = `# Engineering Standards

\`\`\`gates
lint: npm run lint # No lint errors.
test: npm test # Suite green.
\`\`\`
`;

const CONTEXT = {
  architecture: '# Architecture\n\nA Next.js app with an auth service.',
  specifications: '# Specifications\n\nFR-1: users can sign in.',
  fileStructure: '.\n  src/\n    auth/\n  tests/\n',
  standards: STANDARDS,
};

const GOOD_PLAN = [
  '- T-001 | Initialise the repository and toolchain | depends: none | files: package.json, .eslintrc.js | outcome: lint passes in CI',
  '- T-002 | Configure the test harness | depends: T-001 | files: jest.config.js, tests/smoke.test.ts | outcome: one passing test',
  '- T-003 | Implement the session store | depends: T-002 | files: src/auth/session.ts, tests/auth/session.test.ts | outcome: sessions persist',
  '- T-004 | Implement the sign-in endpoint | depends: T-003 | files: src/api/signin.ts, tests/api/signin.test.ts | outcome: POST /signin returns a token',
  '- T-005 | Add the sign-in screen | depends: T-004 | files: src/app/signin/page.tsx, tests/ui/signin.test.tsx | outcome: the form submits and redirects',
  '- T-006 | Add session expiry handling | depends: T-003 | files: src/auth/expiry.ts, tests/auth/expiry.test.ts | outcome: expired sessions are rejected',
  '- T-007 | Add structured request logging | depends: T-001 | files: src/lib/logger.ts, tests/lib/logger.test.ts | outcome: requests log with a trace id',
  '- T-008 | Containerise the app | depends: T-002 | files: Dockerfile, docker-compose.yml | outcome: the image builds and serves the app',
  '- T-009 | Add the CI deployment workflow | depends: T-008 | files: .github/workflows/deploy.yml | outcome: a tagged push deploys',
].join('\n');

const TASK_BODY = `# T-003 — Implement the session store

## Objective

Sessions persist across a restart.

## Context

The store sits behind the auth service and satisfies \`FR-1\`.

## Preconditions

- [ ] T-002 is merged.
- [ ] The suite passes on a clean checkout.

## Scope

### In scope

- The session module and its tests.

### Out of scope

- Token rotation, owned by T-006.
- Any change to \`src/api/signin.ts\`.

## Files

| Path | Action | Purpose |
| --- | --- | --- |
| \`src/auth/session.ts\` | create | Session persistence. |
| \`tests/auth/session.test.ts\` | create | Session tests. |

## Interfaces And Contracts

\`\`\`ts
export function createSession(userId: string): Promise<Session>;
\`\`\`

## Implementation Steps

1. Create \`src/auth/session.ts\` exporting \`createSession\`.
2. Persist through the storage adapter from T-002.
3. Export it from the auth barrel file.

## Testing Requirements

- \`tests/auth/session.test.ts\`: a session round-trips through storage.
- \`tests/auth/session.test.ts\`: an unknown id resolves to \`null\`.

## Required Libraries

None.

## Documentation

- Storage adapter API in \`reference/storage/README.md\`.

## Acceptance Criteria

- [ ] \`createSession\` is exported from \`src/auth/session.ts\`.
- [ ] \`npm test\` passes with the new cases in \`tests/auth/session.test.ts\`.
- [ ] An unknown session id resolves to \`null\`.
- [ ] A restart preserves an active session id.
`;

describe('generateTasks', () => {
  it('returns an ordered plan with ids, dependencies and files', async () => {
    generate.mockResolvedValue({ output: GOOD_PLAN });

    const result = await generateTasks(CONTEXT, 'key', 'test/model', 'https://api.test/v1');

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.tasks).toHaveLength(9);
    expect(result.tasks[0].id).toBe('T-001');
    expect(result.tasks[2]).toMatchObject({
      id: 'T-003',
      dependsOn: ['T-002'],
      files: ['src/auth/session.ts', 'tests/auth/session.test.ts'],
    });
    expect(result.planIssues).toEqual([]);
  });

  it('injects the standards and the file structure into the prompt', async () => {
    generate.mockResolvedValue({ output: GOOD_PLAN });
    await generateTasks(CONTEXT, 'key', 'test/model', 'https://api.test/v1');

    const { prompt, system } = generate.mock.calls[0][0];
    expect(system).toContain('lead engineer');
    expect(prompt).toContain('npm run lint');
    expect(prompt).toContain('src/');
    expect(prompt).toContain('depends:');
  });

  it('re-asks with the specific defects when the plan is unusable', async () => {
    generate
      .mockResolvedValueOnce({ output: '- Do everything' })
      .mockResolvedValueOnce({ output: GOOD_PLAN });

    const result = await generateTasks(CONTEXT, 'key', 'test/model', 'https://api.test/v1');

    expect(generate).toHaveBeenCalledTimes(2);
    const repairPrompt = generate.mock.calls[1][0].prompt;
    expect(repairPrompt).toContain('Revision required');
    expect(repairPrompt).toContain('<previous-attempt>');
    expect(repairPrompt).toMatch(/at least 8|files:|outcome:/);
    expect(result.tasks).toHaveLength(9);
  });

  it('keeps the best attempt rather than failing outright', async () => {
    generate.mockResolvedValue({ output: '- T-001 | Only task | depends: none | files: a.ts | outcome: x' });

    const result = await generateTasks(CONTEXT, 'key', 'test/model', 'https://api.test/v1');

    expect(generate).toHaveBeenCalledTimes(3);
    expect(result.tasks).toHaveLength(1);
    expect(result.planIssues?.some((issue) => issue.severity === 'error')).toBe(true);
  });

  it('reorders a plan whose dependencies point backwards', async () => {
    generate.mockResolvedValue({
      output: [
        '- T-001 | Uses the base | depends: T-002 | files: a.ts | outcome: x',
        '- T-002 | The base | depends: none | files: b.ts | outcome: y',
      ].join('\n'),
    });

    const result = await generateTasks(CONTEXT, 'key', 'test/model', 'https://api.test/v1');
    expect(result.tasks.map((task) => task.id)).toEqual(['T-002', 'T-001']);
  });

  it('requires a model', async () => {
    await expect(generateTasks(CONTEXT)).rejects.toThrow(/Model is required/);
  });
});

describe('researchTask', () => {
  const input = {
    title: 'Implement the session store',
    taskId: 'T-003',
    dependsOn: ['T-002'],
    files: ['src/auth/session.ts', 'tests/auth/session.test.ts'],
    outcome: 'sessions persist',
    precedingTasks: [
      { id: 'T-001', title: 'Initialise the repository' },
      { id: 'T-002', title: 'Configure the test harness' },
    ],
    ...CONTEXT,
  };

  it('produces a document that satisfies the agent-ready contract', async () => {
    generate.mockResolvedValue({ output: TASK_BODY });

    const { markdownContent, issues } = await researchTask(input, 'key', 'test/model', 'https://api.test/v1');

    expect(issues).toBeUndefined();
    expect(blockingIssues(validateTaskDocument(markdownContent, {
      taskId: 'T-003',
      requireAppendedSections: true,
    }))).toEqual([]);
  });

  it('carries machine-readable frontmatter for an orchestrator', async () => {
    generate.mockResolvedValue({ output: TASK_BODY });

    const { markdownContent } = await researchTask(input, 'key', 'test/model', 'https://api.test/v1');
    const { frontmatter } = parseFrontmatter(markdownContent);

    expect(frontmatter).toMatchObject({
      id: 'T-003',
      depends_on: ['T-002'],
      status: 'pending',
      gates: ['lint', 'test'],
    });
  });

  it('appends the project gate commands instead of per-task inventions', async () => {
    generate.mockResolvedValue({ output: TASK_BODY });

    const { markdownContent } = await researchTask(input, 'key', 'test/model', 'https://api.test/v1');

    expect(markdownContent).toContain('- [ ] `npm run lint` exits zero — No lint errors.');
    expect(markdownContent).toContain('- [ ] `npm test` exits zero — Suite green.');
    expect(markdownContent).toContain('## Definition Of Done');
    expect(markdownContent).toContain('## If You Cannot Finish');
  });

  it('tells the model which tasks already landed and which gates apply', async () => {
    generate.mockResolvedValue({ output: TASK_BODY });
    await researchTask(input, 'key', 'test/model', 'https://api.test/v1');

    const { prompt } = generate.mock.calls[0][0];
    expect(prompt).toContain('T-002 — Configure the test harness');
    expect(prompt).toContain('never re-implement it');
    expect(prompt).toContain('lint → `npm run lint`');
    expect(prompt).toContain('**Files assigned by the plan:**');
  });

  it('re-asks with the contract violations from the previous attempt', async () => {
    generate
      .mockResolvedValueOnce({ output: '# T-003 — Implement the session store\n\n## Context\n\nToo thin.\n' })
      .mockResolvedValueOnce({ output: TASK_BODY });

    const { markdownContent } = await researchTask(input, 'key', 'test/model', 'https://api.test/v1');

    expect(generate).toHaveBeenCalledTimes(2);
    const repairPrompt = generate.mock.calls[1][0].prompt;
    expect(repairPrompt).toContain('Defects to fix');
    expect(repairPrompt).toContain('Missing required sections');
    expect(markdownContent).toContain('## Acceptance Criteria');
  });

  it('returns the least-broken attempt with its issues when repair fails', async () => {
    generate.mockResolvedValue({ output: '# T-003 — Implement the session store\n\n## Context\n\nToo thin.\n' });

    const { markdownContent, issues } = await researchTask(input, 'key', 'test/model', 'https://api.test/v1');

    expect(generate).toHaveBeenCalledTimes(3);
    expect(issues?.some((issue) => issue.severity === 'error')).toBe(true);
    // Gates are appended regardless, so a partial brief is still verifiable.
    expect(markdownContent).toContain('## Quality Gates');
  });

  it('adds the TDD clause and directive when TDD is enabled', async () => {
    generate.mockResolvedValue({ output: TASK_BODY });

    const { markdownContent } = await researchTask(input, 'key', 'test/model', 'https://api.test/v1', true);

    expect(generate.mock.calls[0][0].prompt).toContain('Red → Green → Refactor');
    expect(markdownContent).toContain('driven by a test that failed first');
  });

  it('falls back to placeholder gates when no standards are supplied', async () => {
    generate.mockResolvedValue({ output: TASK_BODY });

    const { markdownContent } = await researchTask(
      { ...input, standards: undefined },
      'key',
      'test/model',
      'https://api.test/v1'
    );

    expect(markdownContent).toContain('<project test command>');
  });
});
