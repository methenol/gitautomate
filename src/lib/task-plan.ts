/**
 * Task plan parsing, validation and ordering.
 *
 * The planner emits one line per task in a labelled, pipe-delimited record:
 *
 *   - T-003 | Implement the session store | depends: T-001, T-002 | files: src/auth/session.ts, tests/auth/session.test.ts | outcome: sessions survive a restart
 *
 * The format is deliberately line-oriented rather than YAML or JSON: small local
 * models mangle nested indentation constantly, but they keep one record on one
 * line reliably. Anything unparseable degrades to "title only" instead of
 * throwing away the task.
 */

export interface PlannedTask {
  /** Stable id such as `T-001`. Synthesised when the model omits one. */
  id: string;
  title: string;
  /** Ids of tasks that must be complete first. */
  dependsOn: string[];
  /** Primary paths the task is expected to touch. */
  files: string[];
  /** The observable result that proves the task landed. */
  outcome?: string;
}

export interface PlanIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface ParsedPlan {
  tasks: PlannedTask[];
  issues: PlanIssue[];
}

/** Bullet lines that are structure, not work. */
const SECTION_HEADING_PATTERN =
  /^(-{2,}.*-{2,}|#{1,6}\s|\*\*[^*]+\*\*:?$|(phase|milestone|stage|section|group)\b.*:$)/i;

const ID_PATTERN = /^T-?(\d{1,3})$/i;

function normaliseId(raw: string, fallbackIndex: number): string {
  const match = raw.trim().match(ID_PATTERN);
  if (match) {
    return `T-${match[1].padStart(3, '0')}`;
  }
  return `T-${String(fallbackIndex + 1).padStart(3, '0')}`;
}

function splitList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed || /^(none|n\/a|-|—)$/i.test(trimmed)) {
    return [];
  }
  return trimmed
    .replace(/^\[|\]$/g, '')
    .split(/[,;]/)
    .map((item) => item.trim().replace(/^[`'"]|[`'"]$/g, ''))
    .filter((item) => item.length > 0);
}

function stripBullet(line: string): string | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
  return match ? match[1].trim() : null;
}

/** Parse the planner's markdown into structured tasks. Never throws. */
export function parseTaskPlan(markdown: string): ParsedPlan {
  const issues: PlanIssue[] = [];
  const tasks: PlannedTask[] = [];
  const source = (markdown ?? '').replace(/```[a-z]*\n?|```/gi, '');

  for (const rawLine of source.split(/\r?\n/)) {
    const bullet = stripBullet(rawLine);
    if (!bullet) continue;
    if (SECTION_HEADING_PATTERN.test(bullet)) {
      issues.push({
        severity: 'warning',
        message: `Dropped "${bullet.slice(0, 60)}" — it is a grouping label, not a task.`,
      });
      continue;
    }

    const fields = bullet.split('|').map((field) => field.trim());
    const task: PlannedTask = { id: '', title: '', dependsOn: [], files: [] };

    if (fields.length === 1) {
      // Bare title. Tolerated, but the plan is weaker for it.
      task.title = fields[0].replace(/^\*\*|\*\*$/g, '').trim();
    } else {
      const [first, second, ...rest] = fields;
      const looksLikeId = ID_PATTERN.test(first.replace(/[`*]/g, ''));
      task.id = looksLikeId ? first.replace(/[`*]/g, '') : '';
      task.title = (looksLikeId ? second : first).replace(/^\*\*|\*\*$/g, '').trim();

      const labelled = looksLikeId ? rest : [second, ...rest];
      for (const field of labelled) {
        const separator = field.indexOf(':');
        if (separator <= 0) continue;
        const key = field.slice(0, separator).trim().toLowerCase();
        const value = field.slice(separator + 1).trim();

        if (key.startsWith('depend') || key === 'after' || key === 'blocked by') {
          task.dependsOn = splitList(value);
        } else if (key.startsWith('file') || key === 'paths') {
          task.files = splitList(value);
        } else if (key.startsWith('outcome') || key.startsWith('verif') || key.startsWith('result')) {
          task.outcome = value;
        }
      }
    }

    // Strip a leading id that leaked into the title ("T-004: Do the thing").
    task.title = task.title.replace(/^T-?\d{1,3}\s*[—:-]\s*/i, '').trim();
    if (!task.title) continue;

    task.id = normaliseId(task.id, tasks.length);
    task.dependsOn = task.dependsOn.map((dep) => normaliseId(dep, -1)).filter((dep) => dep !== 'T-000');
    tasks.push(task);
  }

  // Ids must be unique; renumber collisions rather than dropping work.
  const seen = new Set<string>();
  tasks.forEach((task, index) => {
    if (seen.has(task.id)) {
      const replacement = `T-${String(index + 1).padStart(3, '0')}`;
      issues.push({
        severity: 'warning',
        message: `Duplicate id ${task.id} on "${task.title}" — renumbered to ${replacement}.`,
      });
      task.id = replacement;
    }
    seen.add(task.id);
  });

  // Dependencies must resolve; a dangling one is dropped so ordering stays sane.
  for (const task of tasks) {
    const unresolved = task.dependsOn.filter((dep) => !seen.has(dep) || dep === task.id);
    if (unresolved.length > 0) {
      issues.push({
        severity: 'warning',
        message: `${task.id} depends on unknown task(s) ${unresolved.join(', ')} — dropped.`,
      });
      task.dependsOn = task.dependsOn.filter((dep) => !unresolved.includes(dep));
    }
  }

  return { tasks, issues };
}

/**
 * Order tasks so dependencies always precede dependants, preserving the planner's
 * sequence otherwise. Cycles are broken by falling back to plan order.
 */
export function orderTasks(tasks: PlannedTask[]): { tasks: PlannedTask[]; issues: PlanIssue[] } {
  const issues: PlanIssue[] = [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered: PlannedTask[] = [];
  const state = new Map<string, 'visiting' | 'done'>();

  const visit = (task: PlannedTask, trail: string[]): void => {
    const status = state.get(task.id);
    if (status === 'done') return;
    if (status === 'visiting') {
      issues.push({
        severity: 'error',
        message: `Dependency cycle: ${[...trail, task.id].join(' → ')}. Ordering falls back to plan order.`,
      });
      return;
    }

    state.set(task.id, 'visiting');
    for (const depId of task.dependsOn) {
      const dep = byId.get(depId);
      if (dep) visit(dep, [...trail, task.id]);
    }
    state.set(task.id, 'done');
    ordered.push(task);
  };

  for (const task of tasks) {
    visit(task, []);
  }

  return { tasks: ordered.length === tasks.length ? ordered : tasks, issues };
}

/** Quality checks on the plan as a whole, surfaced to the user and to repair prompts. */
export function validatePlan(tasks: PlannedTask[]): PlanIssue[] {
  const issues: PlanIssue[] = [];

  if (tasks.length < 8) {
    issues.push({
      severity: 'error',
      message: `Only ${tasks.length} task(s) were produced. A real project plan needs at least 8; break the work down further.`,
    });
  }

  const withoutFiles = tasks.filter((task) => task.files.length === 0);
  if (withoutFiles.length > 0) {
    issues.push({
      severity: 'error',
      message: `These tasks have no \`files:\` field: ${withoutFiles
        .map((task) => task.id)
        .join(', ')}. Every task must name the paths it touches.`,
    });
  }

  const withoutOutcome = tasks.filter((task) => !task.outcome);
  if (withoutOutcome.length > 0) {
    issues.push({
      severity: 'error',
      message: `These tasks have no \`outcome:\` field: ${withoutOutcome
        .map((task) => task.id)
        .join(', ')}. State the observable result for each.`,
    });
  }

  const vague = tasks.filter((task) =>
    /^(setup|misc|various|other|polish|cleanup|refactor|improvements?)\b/i.test(task.title.trim())
  );
  if (vague.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Vague titles: ${vague.map((task) => `${task.id} ("${task.title}")`).join(', ')}. Say what changes and where.`,
    });
  }

  const dependants = tasks.filter((task) => task.dependsOn.length > 0);
  if (tasks.length > 3 && dependants.length === 0) {
    issues.push({
      severity: 'error',
      message: 'No task declares a dependency. Real plans have ordering constraints — declare them with `depends:`.',
    });
  }

  const longTitles = tasks.filter((task) => task.title.length > 90);
  if (longTitles.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Titles over 90 characters (probably more than one task): ${longTitles
        .map((task) => task.id)
        .join(', ')}.`,
    });
  }

  return issues;
}

/** Render the plan as a dependency-ordered checklist for `docs/PLAN.md`. */
export function renderPlanMarkdown(tasks: PlannedTask[]): string {
  const rows = tasks.map((task, index) => {
    const file = `tasks/task-${String(index + 1).padStart(3, '0')}.md`;
    const deps = task.dependsOn.length > 0 ? task.dependsOn.join(', ') : '—';
    return `| ${task.id} | [${task.title}](../${file}) | ${deps} | ${task.outcome ?? '—'} |`;
  });

  return `# Implementation Plan

Work the tasks in this order. Each row links to a self-contained task file that can be
handed to a coding agent as its entire prompt. Do not start a task until every task in
its "Depends on" column is merged and its quality gates pass.

| ID | Task | Depends on | Done when |
| --- | --- | --- | --- |
${rows.join('\n')}

## Progress

${tasks
  .map((task, index) => `- [ ] ${task.id} — ${task.title} (\`tasks/task-${String(index + 1).padStart(3, '0')}.md\`)`)
  .join('\n')}
`;
}
