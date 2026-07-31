/**
 * Gate parsing is what keeps every task file checking itself the same way.
 */
import {
  PLACEHOLDER_GATES,
  parseQualityGates,
  renderGateChecklist,
  renderGateSummary,
  resolveQualityGates,
} from '@/lib/quality-gates';

const STANDARDS = `# Engineering Standards

## Quality Gates

Everything must pass before a task is done.

\`\`\`gates
lint: npm run lint # No lint errors.
Type Check: npm run typecheck
test: \`npm test\` # Full suite green.
coverage: npm run test:coverage
\`\`\`
`;

describe('parseQualityGates', () => {
  it('extracts ids, commands and descriptions', () => {
    const gates = parseQualityGates(STANDARDS);

    expect(gates).toEqual([
      { id: 'lint', command: 'npm run lint', description: 'No lint errors.' },
      { id: 'type-check', command: 'npm run typecheck', description: undefined },
      { id: 'test', command: 'npm test', description: 'Full suite green.' },
      { id: 'coverage', command: 'npm run test:coverage', description: undefined },
    ]);
  });

  it('keeps commands containing colons intact', () => {
    const gates = parseQualityGates('```gates\ntest: npm run test:unit -- --ci\n```');
    expect(gates[0].command).toBe('npm run test:unit -- --ci');
  });

  it('ignores comments, blank lines and duplicate ids', () => {
    const gates = parseQualityGates('```gates\n# a comment\n\nlint: a\nlint: b\n```');
    expect(gates).toHaveLength(1);
    expect(gates[0].command).toBe('a');
  });

  it('returns nothing when there is no gates fence', () => {
    expect(parseQualityGates('# Standards\n\nRun the tests.')).toEqual([]);
  });
});

describe('resolveQualityGates', () => {
  it('falls back to placeholders so task files are never gate-less', () => {
    expect(resolveQualityGates('no fence here')).toEqual(PLACEHOLDER_GATES);
    expect(resolveQualityGates(undefined)).toEqual(PLACEHOLDER_GATES);
  });

  it('prefers parsed gates', () => {
    expect(resolveQualityGates(STANDARDS)).toHaveLength(4);
  });
});

describe('rendering', () => {
  it('renders a checkbox per gate with the exact command', () => {
    const checklist = renderGateChecklist(parseQualityGates(STANDARDS));

    expect(checklist).toContain('- [ ] `npm run lint` exits zero — No lint errors.');
    expect(checklist).toContain('- [ ] `npm run typecheck` exits zero');
    expect(checklist.split('\n')).toHaveLength(4);
  });

  it('summarises gates for prompt injection', () => {
    expect(renderGateSummary(parseQualityGates(STANDARDS))).toContain('lint → `npm run lint`');
  });
});
