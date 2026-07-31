/**
 * The task document contract.
 *
 * A task file is not documentation — it is a prompt. It gets handed to a coding
 * agent in a fresh session as the agent's entire brief, so this module defines the
 * shape that makes such a hand-off survivable, assembles the parts the app owns
 * (frontmatter, quality gates, definition of done) and validates the parts the
 * model owns.
 *
 * Browser-safe on purpose: the UI validates a task the user has just edited using
 * exactly the same rules the generator does.
 */

import { withFrontmatter } from '@/lib/frontmatter';
import { renderGateChecklist, type QualityGate } from '@/lib/quality-gates';

/** Sections the model is responsible for producing, in order. */
export const MODEL_SECTIONS = [
  'Objective',
  'Context',
  'Preconditions',
  'Scope',
  'Files',
  'Interfaces And Contracts',
  'Implementation Steps',
  'Testing Requirements',
  'Required Libraries',
  'Documentation',
  'Acceptance Criteria',
] as const;

/** Sections the app appends deterministically from the project standards. */
export const APPENDED_SECTIONS = ['Quality Gates', 'Definition Of Done'] as const;

export const ALL_SECTIONS = [...MODEL_SECTIONS, ...APPENDED_SECTIONS] as const;

export interface TaskDocumentIssue {
  severity: 'error' | 'warning';
  message: string;
}

/** Case-insensitive heading lookup that tolerates trailing annotations. */
function headingPattern(heading: string): RegExp {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^##\\s+(?:\\d+\\.\\s*)?${escaped}\\b.*$`, 'im');
}

export function hasSection(content: string, heading: string): boolean {
  return headingPattern(heading).test(content ?? '');
}

/** Body of a `##` section, up to the next `##` heading. */
export function extractSection(content: string, heading: string): string {
  const match = (content ?? '').match(headingPattern(heading));
  if (!match || match.index === undefined) return '';

  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const next = rest.search(/^##\s+/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function countCheckboxes(section: string): number {
  return (section.match(/^\s*[-*+]\s+\[[ xX]\]/gm) ?? []).length;
}

function countBullets(section: string): number {
  return (section.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm) ?? []).length;
}

/** Phrases that mean "the model did not actually decide anything here". */
const FILLER_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /\bTBD\b|\bTODO\b|\bFIXME\b/i, message: 'contains TBD/TODO/FIXME placeholders' },
  { pattern: /\{[a-z][a-z0-9 _-]{2,}\}/i, message: 'contains unreplaced {placeholder} text from the template' },
  { pattern: /\bas (?:appropriate|needed|necessary)\b/i, message: 'defers decisions with "as appropriate/needed"' },
  { pattern: /\bfollow best practices\b/i, message: 'says "follow best practices" instead of naming the practice' },
  { pattern: /\bsomething like\b|\bor similar\b|\betc\.?(\s|$)/i, message: 'hedges with "something like"/"or similar"/"etc."' },
  { pattern: /\bLorem ipsum\b/i, message: 'contains lorem ipsum' },
];

export interface ValidateTaskOptions {
  /** Expected task id, checked against the H1 and frontmatter. */
  taskId?: string;
  /** Expected task title, checked against the H1. */
  title?: string;
  /** When true, the appended sections must already be present. */
  requireAppendedSections?: boolean;
}

/**
 * Validate a task document against the contract.
 *
 * Errors are worth a repair round-trip with the model; warnings are surfaced to the
 * user but do not block. The messages are written to be fed straight back into a
 * prompt, so they say what to do, not just what is wrong.
 */
export function validateTaskDocument(
  content: string,
  options: ValidateTaskOptions = {}
): TaskDocumentIssue[] {
  const issues: TaskDocumentIssue[] = [];
  const document = content ?? '';
  const error = (message: string) => issues.push({ severity: 'error', message });
  const warn = (message: string) => issues.push({ severity: 'warning', message });

  if (document.trim().length === 0) {
    error('The document is empty.');
    return issues;
  }

  // --- Shape -------------------------------------------------------------
  const h1 = document.match(/^#\s+(.+)$/m);
  if (!h1) {
    error('Missing the `# <id> — <title>` H1 heading on the first content line.');
  } else if (options.taskId && !h1[1].includes(options.taskId)) {
    error(`The H1 heading must start with the task id \`${options.taskId}\`. Found: "${h1[1].trim()}".`);
  }

  const expected = options.requireAppendedSections ? ALL_SECTIONS : MODEL_SECTIONS;
  const missing = expected.filter((heading) => !hasSection(document, heading));
  if (missing.length > 0) {
    error(`Missing required sections: ${missing.map((heading) => `"## ${heading}"`).join(', ')}.`);
  }

  // --- Section-level substance -------------------------------------------
  const objective = extractSection(document, 'Objective');
  if (objective && objective.split(/(?<=[.!?])\s/).filter((s) => s.trim()).length > 3) {
    warn('The Objective should be one or two sentences. Move the detail into Context or Implementation Steps.');
  }

  const scope = extractSection(document, 'Scope');
  if (scope && !/out of scope/i.test(scope)) {
    error('The Scope section must contain an "### Out of scope" subsection listing explicit non-goals.');
  }

  const files = extractSection(document, 'Files');
  if (files) {
    const paths = files.match(/`[^`]*\/[^`]*`|`[\w.-]+\.[a-z0-9]+`/gi) ?? [];
    if (paths.length === 0) {
      error('The Files section must list concrete repository-relative paths in backticks, with an action for each (create/modify).');
    }
    if (!/\b(create|modify|delete|add|update|rename)\b/i.test(files)) {
      warn('The Files section should state an action (create/modify/delete) for each path.');
    }
  }

  const steps = extractSection(document, 'Implementation Steps');
  if (steps) {
    const stepCount = countBullets(steps);
    if (stepCount < 3) {
      error(`The Implementation Steps section has ${stepCount} step(s). Break the work into at least 3 ordered, numbered steps.`);
    }
  }

  const testing = extractSection(document, 'Testing Requirements');
  if (testing) {
    if (countBullets(testing) < 2) {
      error('The Testing Requirements section must list the specific test cases to write, including at least one failure or edge case.');
    }
    if (!/`[^`]+`/.test(testing)) {
      warn('The Testing Requirements section should name the test file paths in backticks.');
    }
  }

  const criteria = extractSection(document, 'Acceptance Criteria');
  if (criteria) {
    const checkboxes = countCheckboxes(criteria);
    if (checkboxes < 3) {
      error(
        `The Acceptance Criteria section has ${checkboxes} checkbox item(s). Provide at least 3 as \`- [ ] ...\`, each independently verifiable.`
      );
    }
    if (!/`[^`]+`/.test(criteria)) {
      error('Every acceptance criterion must be verifiable — reference a command, path, or symbol in backticks so it can be checked mechanically.');
    }
    const subjective = criteria.match(/\b(clean|readable|maintainable|robust|efficient|user-friendly|properly|correctly)\b/gi);
    if (subjective && subjective.length > 1) {
      warn(
        `Acceptance criteria use subjective wording (${[...new Set(subjective.map((w) => w.toLowerCase()))].join(', ')}). Replace with an observable check.`
      );
    }
  }

  const libraries = extractSection(document, 'Required Libraries');
  if (libraries && libraries.trim().length < 3) {
    warn('The Required Libraries section is empty. State "None." explicitly if the task needs no new dependencies.');
  }

  // --- Global hygiene ----------------------------------------------------
  // Filler checks run on prose only: `{ id }` inside a schema block is fine,
  // `{describe the thing}` in a sentence is a template leak.
  const prose = document.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  for (const { pattern, message } of FILLER_PATTERNS) {
    if (pattern.test(prose)) {
      error(`The document ${message}. Replace it with a specific decision.`);
    }
  }

  const fences = document.match(/```[\s\S]*?```/g) ?? [];
  const longFence = fences.find((fence) => fence.split('\n').length > 25);
  if (longFence) {
    warn('A code block exceeds 25 lines. Task files specify interfaces and signatures — the agent writes the implementation.');
  }

  if (document.length < 1_200) {
    error('The document is too thin to implement from. Expand every section with task-specific detail.');
  }

  return issues;
}

/** Only the messages that justify asking the model again. */
export function blockingIssues(issues: TaskDocumentIssue[]): string[] {
  return issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
}

export interface AssembleTaskOptions {
  taskId: string;
  title: string;
  /** Model-generated body (Objective … Acceptance Criteria). */
  body: string;
  dependsOn?: string[];
  files?: string[];
  gates: QualityGate[];
  useTDD?: boolean;
}

/**
 * Append the app-owned sections and frontmatter.
 *
 * Quality gates and the definition of done are rendered from the project standards
 * rather than generated per task, so all task files check themselves identically —
 * this is the difference between a plan an agent can grind and a pile of prose.
 */
export function assembleTaskDocument(options: AssembleTaskOptions): string {
  const { taskId, title, body, dependsOn = [], files = [], gates, useTDD } = options;

  const footer = `## Quality Gates

Run these from the repository root. Every one must pass before this task is done. If a
gate fails, fix the cause — never weaken the gate, skip a test, lower a threshold, or
disable a rule to get a green run.

${renderGateChecklist(gates)}

## Definition Of Done

- [ ] Every acceptance criterion above is checked and demonstrably true.
- [ ] Every quality gate above exits zero on a clean checkout of this branch.
- [ ] Only the files listed in this task changed (plus dependency manifests if a listed library was added).
- [ ] New behaviour is covered by tests that fail if the behaviour is reverted.${
    useTDD ? '\n- [ ] Each behaviour was driven by a test that failed first (Red → Green → Refactor).' : ''
  }
- [ ] No debugging leftovers: no commented-out code, stray logs, skipped tests, or \`.only\` in a test file.
- [ ] The work is committed with a message describing the behaviour change, following the project's commit convention.
- [ ] \`docs/PLAN.md\` has this task's checkbox ticked.

## If You Cannot Finish

Stop and report rather than improvising:

1. Leave the working tree in a state where every quality gate still passes, even if the
   feature is incomplete — no broken builds, no failing or disabled tests on the branch.
2. Append a short \`## Blocked\` note to this task file: what you tried, the exact error,
   and what decision is needed.
3. Do not expand the task's scope, edit files it does not own, or change another task's
   acceptance criteria to make this one fit.`;

  const heading = `# ${taskId} — ${title}`;
  const withHeading = /^#\s+/m.test(body.trim())
    ? body.trim().replace(/^#\s+.*$/m, heading)
    : `${heading}\n\n${body.trim()}`;

  const document = `${withHeading}\n\n${footer}\n`;

  return withFrontmatter(document, {
    id: taskId,
    title,
    depends_on: dependsOn,
    files,
    status: 'pending',
    gates: gates.map((gate) => gate.id),
  });
}
