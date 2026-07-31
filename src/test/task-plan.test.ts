/**
 * The plan parser has to be forgiving about formatting and strict about structure:
 * weak models produce sloppy records, but ordering and dependencies must still hold.
 */
import {
  orderTasks,
  parseTaskPlan,
  renderPlanMarkdown,
  validatePlan,
} from '@/lib/task-plan';

const PLAN = `- T-001 | Initialise the repository and toolchain | depends: none | files: package.json, tsconfig.json | outcome: lint and typecheck pass in CI
- T-002 | Configure the test harness with a smoke test | depends: T-001 | files: jest.config.js, tests/smoke.test.ts | outcome: \`npm test\` reports one passing test
- T-003 | Implement the session store | depends: T-001, T-002 | files: src/auth/session.ts, tests/auth/session.test.ts | outcome: sessions survive a restart`;

describe('parseTaskPlan', () => {
  it('parses ids, titles, dependencies, files and outcomes', () => {
    const { tasks, issues } = parseTaskPlan(PLAN);

    expect(issues).toHaveLength(0);
    expect(tasks).toHaveLength(3);
    expect(tasks[2]).toEqual({
      id: 'T-003',
      title: 'Implement the session store',
      dependsOn: ['T-001', 'T-002'],
      files: ['src/auth/session.ts', 'tests/auth/session.test.ts'],
      outcome: 'sessions survive a restart',
    });
    expect(tasks[0].dependsOn).toEqual([]);
  });

  it('drops grouping labels instead of treating them as work', () => {
    const { tasks, issues } = parseTaskPlan(
      `- -- BACKEND FOUNDATION --\n- **Phase 1:**\n- T-001 | Do the thing | depends: none | files: a.ts | outcome: it works`
    );

    expect(tasks.map((task) => task.title)).toEqual(['Do the thing']);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('tolerates bare titles and numbered lists by synthesising ids', () => {
    const { tasks } = parseTaskPlan('1. Set up the project\n2. Build the API');

    expect(tasks.map((task) => [task.id, task.title])).toEqual([
      ['T-001', 'Set up the project'],
      ['T-002', 'Build the API'],
    ]);
  });

  it('strips an id that leaked into the title', () => {
    const { tasks } = parseTaskPlan('- T-002: Implement login | depends: none | files: a.ts | outcome: x');
    expect(tasks[0].title).toBe('Implement login');
  });

  it('normalises loose id spellings in dependencies', () => {
    const { tasks } = parseTaskPlan(
      `- T1 | First | depends: none | files: a.ts | outcome: x\n- T2 | Second | depends: T1 | files: b.ts | outcome: y`
    );

    expect(tasks[0].id).toBe('T-001');
    expect(tasks[1].dependsOn).toEqual(['T-001']);
  });

  it('drops dependencies that do not resolve', () => {
    const { tasks, issues } = parseTaskPlan(
      '- T-001 | First | depends: T-009 | files: a.ts | outcome: x'
    );

    expect(tasks[0].dependsOn).toEqual([]);
    expect(issues[0].message).toContain('unknown task');
  });

  it('renumbers duplicate ids rather than losing a task', () => {
    const { tasks, issues } = parseTaskPlan(
      `- T-001 | First | depends: none | files: a.ts | outcome: x\n- T-001 | Second | depends: none | files: b.ts | outcome: y`
    );

    expect(tasks).toHaveLength(2);
    expect(new Set(tasks.map((task) => task.id)).size).toBe(2);
    expect(issues.some((issue) => issue.message.includes('Duplicate id'))).toBe(true);
  });
});

describe('orderTasks', () => {
  it('moves dependencies ahead of their dependants', () => {
    const { tasks } = parseTaskPlan(
      `- T-001 | Needs the base | depends: T-002 | files: a.ts | outcome: x\n- T-002 | The base | depends: none | files: b.ts | outcome: y`
    );

    const ordered = orderTasks(tasks);
    expect(ordered.tasks.map((task) => task.id)).toEqual(['T-002', 'T-001']);
    expect(ordered.issues).toHaveLength(0);
  });

  it('reports a cycle and falls back to plan order', () => {
    const { tasks } = parseTaskPlan(
      `- T-001 | A | depends: T-002 | files: a.ts | outcome: x\n- T-002 | B | depends: T-001 | files: b.ts | outcome: y`
    );

    const ordered = orderTasks(tasks);
    expect(ordered.issues.some((issue) => issue.message.includes('cycle'))).toBe(true);
    expect(ordered.tasks).toHaveLength(2);
  });

  it('is stable for an already-ordered plan', () => {
    const { tasks } = parseTaskPlan(PLAN);
    expect(orderTasks(tasks).tasks.map((task) => task.id)).toEqual(['T-001', 'T-002', 'T-003']);
  });
});

describe('validatePlan', () => {
  it('flags a plan that is too small to be a real project plan', () => {
    const { tasks } = parseTaskPlan(PLAN);
    const messages = validatePlan(tasks).map((issue) => issue.message);
    expect(messages.some((message) => message.includes('at least 8'))).toBe(true);
  });

  it('flags missing files, missing outcomes and absent dependencies', () => {
    const { tasks } = parseTaskPlan(
      Array.from({ length: 9 }, (_, index) => `- T-00${index + 1} | Task number ${index + 1}`).join('\n')
    );
    const messages = validatePlan(tasks).map((issue) => issue.message);

    expect(messages.some((message) => message.includes('no `files:` field'))).toBe(true);
    expect(messages.some((message) => message.includes('no `outcome:` field'))).toBe(true);
    expect(messages.some((message) => message.includes('No task declares a dependency'))).toBe(true);
  });

  it('warns about vague titles', () => {
    const { tasks } = parseTaskPlan('- T-001 | Cleanup | depends: none | files: a.ts | outcome: x');
    expect(validatePlan(tasks).some((issue) => issue.message.includes('Vague titles'))).toBe(true);
  });
});

describe('renderPlanMarkdown', () => {
  it('renders a dependency table and a progress checklist linking to task files', () => {
    const { tasks } = parseTaskPlan(PLAN);
    const plan = renderPlanMarkdown(tasks);

    expect(plan).toContain('| ID | Task | Depends on | Done when |');
    expect(plan).toContain('[Implement the session store](../tasks/task-003.md)');
    expect(plan).toContain('| T-001, T-002 |');
    expect(plan).toContain('- [ ] T-001 — Initialise the repository and toolchain');
  });
});
