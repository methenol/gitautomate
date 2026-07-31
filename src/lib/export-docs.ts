/**
 * Static documents included in the export.
 *
 * These explain the artefact to whoever (or whatever) opens the zip: how to hand a
 * task file to an agent, and what the rules of engagement are. Kept out of the LLM
 * path because they describe this tool's own conventions, which the model has no
 * business improvising.
 */

import { renderGateChecklist, type QualityGate } from '@/lib/quality-gates';
import { ALL_SECTIONS } from '@/lib/task-document';

/** `tasks/README.md` — the operating manual for grinding the plan. */
export function renderTasksReadme(gates: QualityGate[], useTDD?: boolean): string {
  return `# Tasks

Each \`task-NNN.md\` in this directory is a complete, self-contained brief. Hand one to a
coding agent as its entire prompt — it does not need the conversation that produced it.

## Handing a task to an agent

Give the agent the repository and a prompt of this shape:

\`\`\`text
Implement the task described in tasks/task-003.md.
Read AGENTS.md first for repository conventions.
Work only within that task's scope, satisfy every acceptance criterion, and make every
quality gate pass before you finish. Do not start any other task.
\`\`\`

Do not paste the file contents into a chat window and ad-lib around it. The file is the
contract; changing the contract mid-flight is how plans drift.

## Order of work

\`docs/PLAN.md\` is authoritative. Pick the first unticked task whose dependencies are all
ticked, and finish it before starting another. Each task file's frontmatter carries its
\`id\`, \`depends_on\` and \`status\` so this can be automated.

## Anatomy of a task file

${ALL_SECTIONS.map((section) => `- **${section}**`).join('\n')}

The first eleven sections are generated per task. **Quality Gates** and **Definition Of
Done** are identical across every task in the project — they come from
\`docs/STANDARDS.md\`, so the plan verifies itself the same way everywhere.

## Quality gates

Every task ends with these passing:

${renderGateChecklist(gates)}

A gate is never satisfied by weakening it. Deleting a test, marking it skipped, lowering
a coverage threshold, disabling a lint rule, or suppressing a type error is a failed task,
not a passed gate.

## Reviewing a finished task

1. Every acceptance criterion in the task file is ticked, and you can independently
   verify each one.
2. Every quality gate passes on a clean checkout of the branch.
3. The diff touches only the files listed in the task's **Files** table (plus dependency
   manifests, if the task added a listed library).
4. The tests fail when the new behaviour is reverted.${
    useTDD ? '\n5. Test commits precede the implementation commits they drive.' : ''
  }

## When a task is wrong

Task files are generated, so some will be wrong. Fix the file, not the code: edit the
task's scope or criteria, note what changed and why, then implement against the corrected
brief. A code change that quietly contradicts its brief leaves the plan lying about the
repository.
`;
}
