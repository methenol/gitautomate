/**
 * Quality gates: the executable checks every task must pass before it is done.
 *
 * The standards document carries a machine-readable ```gates fence. Parsing it
 * lets the app render the *same* gate commands into every task file, instead of
 * asking the model to re-invent plausible-looking commands per task (which is how
 * you end up with `npm run test:unit` in task 3 and `yarn test` in task 7).
 */

export interface QualityGate {
  /** Stable slug, e.g. `lint`, `typecheck`, `test`, `coverage`. */
  id: string;
  /** Shell command, runnable from the repository root. */
  command: string;
  /** What passing this gate proves. */
  description?: string;
}

const GATES_FENCE = /```gates[ \t]*\r?\n([\s\S]*?)```/i;

/**
 * The fallback set. Used when the model omits the fence entirely, so downstream
 * documents always have *something* concrete rather than an empty section.
 * Commands are intentionally generic; the standards doc should override them.
 */
export const PLACEHOLDER_GATES: QualityGate[] = [
  { id: 'build', command: '<project build command>', description: 'The project compiles.' },
  { id: 'lint', command: '<project lint command>', description: 'Style and static analysis are clean.' },
  { id: 'test', command: '<project test command>', description: 'The full test suite passes.' },
];

/**
 * Extract gates from a standards document.
 *
 * Accepted line formats inside the fence:
 *   `id: command`
 *   `id: command # description`
 */
export function parseQualityGates(standards: string): QualityGate[] {
  const match = (standards ?? '').match(GATES_FENCE);
  if (!match) {
    return [];
  }

  const gates: QualityGate[] = [];
  const seen = new Set<string>();

  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf(':');
    if (separator <= 0) continue;

    const id = line
      .slice(0, separator)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!id || seen.has(id)) continue;

    let remainder = line.slice(separator + 1).trim();
    let description: string | undefined;

    const commentIndex = remainder.indexOf(' #');
    if (commentIndex >= 0) {
      description = remainder.slice(commentIndex + 2).trim() || undefined;
      remainder = remainder.slice(0, commentIndex).trim();
    }

    const command = remainder.replace(/^[`'"]|[`'"]$/g, '').trim();
    if (!command) continue;

    seen.add(id);
    gates.push({ id, command, description });
  }

  return gates;
}

/** Gates with a fallback, so callers never have to handle the empty case. */
export function resolveQualityGates(standards?: string): QualityGate[] {
  const parsed = parseQualityGates(standards ?? '');
  return parsed.length > 0 ? parsed : PLACEHOLDER_GATES;
}

/**
 * Render gates as a checklist for a task document. Deterministic on purpose —
 * this is the one section no model gets to improvise.
 */
export function renderGateChecklist(gates: QualityGate[]): string {
  return gates
    .map((gate) => {
      const suffix = gate.description ? ` — ${gate.description}` : '';
      return `- [ ] \`${gate.command}\` exits zero${suffix}`;
    })
    .join('\n');
}

/** Compact single-line form used inside prompts. */
export function renderGateSummary(gates: QualityGate[]): string {
  return gates.map((gate) => `${gate.id} → \`${gate.command}\``).join('; ');
}
