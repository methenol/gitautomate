

'use server';

/**
 * @fileOverview Enhanced GitAutomate AI flows using Spec-Kit principles and structured templates
 *
 * This integration layer enhances GitAutomate's existing AI flows by incorporating 
 * spec-kit's structured approach, constitutional principles, and template-based
 * prompting without requiring CLI interactions.
 */

import {ai} from '@/ai/litellm';
import { TaskSchema } from '@/types';
import {z} from 'zod';
import { MarkdownLinter } from '@/services/markdown-linter';

// Enhanced input types that incorporate spec-kit principles
export interface SpecKitArchitectureInput {
  prd: string;
  featureName?: string;
}

export interface SpecKitTasksInput {
  architecture: string;
  specifications: string;
  fileStructure?: string;
}

export interface SpecKitTaskDetailsInput {
  title: string;
  architecture: string;
  specifications: string;
  fileStructure?: string;
}

// Enhanced output types with structured validation
export interface SpecKitArchitectureOutput {
  architecture: string;
  specifications: string;
  featureName?: string;
  validationResults: {
    needsClarification: Array<{
      field: string;
      question: string;
    }>;
    qualityScore: number; // 0-100
  };
}

export interface SpecKitTasksOutput {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    type: 'setup' | 'testing' | 'implementation' | 'integration' | 'polish';
    dependencies?: string[];
    parallelizable: boolean;
    estimatedHours?: number;
  }>;
  validationResults: {
    testFirstCompliance: boolean; // Are tests before implementation?
    parallelExecutionValid: boolean;
    completenessScore: number; // 0-100
  };
}

export interface SpecKitTaskDetailsOutput {
  markdownContent: string;
  validationResults: {
    testDrivenApproach: boolean; // TDD mentioned?
    technicalCompleteness: number; // 0-100
    implementationGuidance: string[];
  };
}

// Constitution principles adapted for GitAutomate
const CONSTITUTION_PRINCIPLES = {
  LIBRARY_FIRST: "Every feature must begin as a standalone library",
  TEST_FIRST: "Test-Driven Development is mandatory - Tests before implementation",
  SIMPLITY_GATE: "Maximum 3 projects for initial implementation, justify complexity",
  ANTI_ABSTRACTION: "Use framework features directly rather than wrapping them unnecessarily"
};

// Spec-Kit inspired templates for enhanced prompting
const SPECIFICATION_TEMPLATE = `
# Feature Specification: [FEATURE_NAME]

## Execution Flow (Enhanced GitAutomate)
1. Parse Product Requirements Document (PRD) from Input
   → If empty: ERROR "No PRD provided"
2. Extract key concepts, actors, actions, and constraints
3. Mark ambiguities with [NEEDS CLARIFICATION] markers
4. Generate User Scenarios & Acceptance Criteria
5. Create Functional Requirements following FR-001, FR-002 pattern
6. Identify Key Entities and their relationships
7. Review against Constitution Principles
8. Return SUCCESS with structured specification

---

## ⚡ Quick Guidelines (Adapted for GitAutomate)
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure initially)
- 👥 Written for business stakeholders and technical teams

## User Scenarios & Testing *(mandatory)*

### Primary User Story
[Describe the main user journey based on PRD]

### Acceptance Scenarios
1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

### Edge Cases
- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST [specific capability]
- **FR-002**: Users MUST be able to [key interaction]

### Key Entities *(include if feature involves data)*
- **[Entity 1]**: [What it represents, key attributes]
- **[Entity 2]**: [Relationships to other entities]

### Constitution Check
- [ ] Library Principle: Feature designed as standalone library?
- [ ] Test First: Tests planned before implementation?
- [ ] Simplicity Gate: ≤3 projects justified?

---

## Review & Acceptance Checklist
### Content Quality
- [ ] No premature implementation details (languages, frameworks)
- [ ] Focused on user value and business needs
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No unresolved [NEEDS CLARIFICATION] markers
- [ ] Requirements are testable and unambiguous  
- [ ] Success criteria are measurable

---

PRD:
{{{prd}}}

Generate a comprehensive specification following this template, marking all ambiguities with [NEEDS CLARIFICATION: specific question].
`;

const TASK_GENERATION_TEMPLATE = `
# Task Generation Plan (Enhanced GitAutomate)

## Execution Flow
1. Load Architecture and Specifications from Input
2. Extract technical requirements and constraints  
3. Generate tasks following spec-kit patterns:
   - Setup: Project initialization, dependencies
   - Testing: Contract tests first (TDD)
   - Implementation: Models → Services → Endpoints
   - Integration: Database, middleware, APIs
   - Polish: Unit tests, documentation

## Task Format Rules
- **[P]** mark for parallel execution (different files)
- Sequential numbers: T001, T002, T003...
- Exact file paths in descriptions
- Tests BEFORE implementation (TDD)

## Constitution Gates
### Simplicity Gate
- [ ] Using ≤3 projects?
- [ ] No unnecessary abstraction?

### Test-First Gate  
- [ ] Contract tests written first?
- [ ] Integration tests planned?

## Task Categories

### Phase 1: Setup
- [ ] T001 Initialize project structure
- [ ] T002 Configure dependencies and linting

### Phase 2: Tests First (TDD)
**CRITICAL: These tests MUST be written before ANY implementation**
- [ ] T003 [P] Contract test for primary API endpoint
- [ ] T004 [P] Integration test for user workflow

### Phase 3: Implementation  
- [ ] T005 Core model creation
- [ ] T006 Service layer implementation

Architecture:
{{{architecture}}}

Specifications:  
{{specifications}}}

Generate actionable tasks following this template and constitution principles.
`;

const TASK_DETAILS_TEMPLATE = `
# Task Implementation Plan: [TASK_TITLE]

## Context
This task is part of a larger feature implementation. The architecture emphasizes modular design with clear separation of concerns.

### Position in Architecture
- **Feature**: [Extract from architecture]
- **Dependencies**: [Related tasks and components]  
- **Integration Points**: [How this connects to other systems]

## Implementation Steps (Enhanced GitAutomate)

### Phase 1: Test-Driven Development Setup
1. **Write Failing Tests** (RED phase)
   - Create test file: {{{testFilePath}}}
   - Define test scenarios that must pass
   - Ensure tests fail with current implementation

2. **Implement to Pass Tests** (GREEN phase)
   - Create minimal implementation to make tests pass
   - Follow architecture patterns and conventions
   - Integrate with existing systems

3. **Refactor** (REFACTOR phase)
   - Improve code quality without changing behavior
   - Apply coding standards and best practices
   - Ensure tests still pass

### Phase 2: Implementation Details
#### Files to Create/Modify
- **{{{mainFile}}}**: [Primary implementation]
- **{{{testFile}}}**: [Unit and integration tests]  
- **{{{configFile}}}?**: [Configuration if needed]

#### Key Components
1. **Core Logic**: [Describe the main functionality]
2. **Data Validation**: [Input validation rules]
3. **Error Handling**: [Exception handling patterns]
4. **Integration Points**: [How this connects to other services]

### Phase 3: Integration & Validation
1. **Unit Testing**: Verify individual components work correctly
2. **Integration Testing**: Test with dependent modules
3. **Contract Compliance**: Ensure API contracts are satisfied

## Technical Requirements (from Architecture & Specifications)
- Technology Stack: [Extract from architecture]
- Performance Constraints: [Response times, scalability]
- Security Requirements: [Authentication, authorization]  
- Data Models: [Entity definitions and relationships]

## Acceptance Criteria
This task is complete when:
- [ ] All tests pass consistently  
- [ ] Implementation follows architecture patterns
- [ ] Integration points work correctly
- [ ] Performance targets are met
- [ ] Security requirements satisfied

## Dependencies and Prerequisites
- **Required Tasks**: [List dependent task IDs]
- **External Services**: [APIs, databases, etc.]
- **Configuration Setup**: [Environment variables, configs]

## Implementation Notes
- Follow Test-Driven Development principles strictly
- Maintain separation of concerns between components  
- Use established coding patterns from the architecture
- Ensure proper error handling and logging
- Document any assumptions or design decisions

---

Architecture Context:
{{{architecture}}}

Specifications:  
{{specifications}}}
`;

export class SpecKitIntegration {
  /**
   * Generate enhanced architecture using spec-kit principles
   */
  async generateArchitectureWithSpecKit(
    input: SpecKitArchitectureInput,
    apiKey?: string, 
    model?: string,
    temperature = 0.7
  ): Promise<SpecKitArchitectureOutput> {
    if (!model) {
      throw new Error('Model is required. Please provide a model in "provider/model" format.');
    }

    const featureName = input.featureName || this.generateFeatureName(input.prd);
    
    // Construct enhanced prompt using spec-kit template
    const prompt = SPECIFICATION_TEMPLATE
      .replace('{{{prd}}}', input.prd)
      .replace('[FEATURE_NAME]', featureName);

    let retries = 3;
    while (retries > 0) {
      try {
        const {output} = await ai.generate({
          model: model,
          prompt: prompt,
          config: apiKey ? {apiKey} : undefined
        });

        const markdownContent = output as string;
        
        // Parse and validate the generated specification
        const parsedSpec = await this.parseSpecification(markdownContent);
        
        // Lint the output for quality
        const lintResult = await MarkdownLinter.lintAndFix(
          markdownContent, 
          `spec-${featureName.toLowerCase().replace(/\s+/g, '-')}.md`
        );

        if (lintResult.isValid) {
          return {
            architecture: parsedSpec.architecture,
            specifications: parsedSpec.specifications,
            featureName,
            validationResults: {
              needsClarification: parsedSpec.ambiguities || [],
              qualityScore: await this.calculateQualityScore(lintResult.fixedContent!)
            }
          };
        }

      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to generate valid specification after retries: ${error}`);
        }
      }
    }

    throw new Error('Architecture generation failed');
  }

  /**
   * Generate enhanced tasks using spec-kit task template
   */
  async generateTasksWithSpecKit(
    input: SpecKitTasksInput,
    apiKey?: string,
    model?: string,
    temperature = 0.7
  ): Promise<SpecKitTasksOutput> {
    if (!model) {
      throw new Error('Model is required. Please provide a model in "provider/model" format.');
    }

    const prompt = TASK_GENERATION_TEMPLATE
      .replace('{{{architecture}}}', input.architecture)
      .replace('{{specifications}}}', input.specifications);

    let retries = 3;
    while (retries > 0) {
      try {
        const {output} = await ai.generate({
          model: model,
          prompt: prompt,
          config: apiKey ? {apiKey} : undefined
        });

        const markdownContent = output as string;
        
        // Parse tasks following spec-kit structure
        const parsedTasks = await this.parseTaskList(markdownContent);
        
        // Validate TDD compliance and parallel execution
        const validationResults = this.validateTaskStructure(parsedTasks);

        return {
          tasks: parsedTasks,
          validationResults
        };

      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to generate valid tasks after retries: ${error}`);
        }
      }
    }

    throw new Error('Task generation failed');
  }

  /**
   * Generate enhanced task details using spec-kit principles
   */
  async generateTaskDetailsWithSpecKit(
    input: SpecKitTaskDetailsInput,
    apiKey?: string,
    model?: string,
    temperature = 0.7
  ): Promise<SpecKitTaskDetailsOutput> {
    if (!model) {
      throw new Error('Model is required. Please provide a model in "provider/model" format.');
    }

    const testFilePath = `tests/${input.title.toLowerCase().replace(/\s+/g, '-')}.test.ts`;
    const mainFile = `src/${input.title.toLowerCase().replace(/\s+/g, '-')}.ts`;
    const configFile = input.fileStructure ? 'config/index.ts' : undefined;

    const prompt = TASK_DETAILS_TEMPLATE
      .replace('{{{taskTitle}}}', input.title)
      .replace('{{{testFilePath}}}', testFilePath)
      .replace('{{{mainFile}}}', mainFile)
      .replace('{{{configFile}}}', configFile || '')
      .replace('{{{architecture}}}', input.architecture)
      .replace('{{specifications}}}', input.specifications);

    let retries = 3;
    while (retries > 0) {
      try {
        const {output} = await ai.generate({
          model: model,
          prompt: prompt,
          config: apiKey ? {apiKey} : undefined
        });

        const markdownContent = output as string;
        
        // Lint and enhance the task details
        const lintResult = await MarkdownLinter.lintAndFix(
          markdownContent,
          `task-${input.title.toLowerCase().replace(/\s+/g, '-')}.md`
        );

        if (lintResult.isValid) {
          return {
            markdownContent: lintResult.fixedContent!,
            validationResults: {
              testDrivenApproach: this.containsTestGuidance(lintResult.fixedContent!),
              technicalCompleteness: await this.calculateTechnicalCompleteness(lintResult.fixedContent!),
              implementationGuidance: this.extractImplementationGuidelines(lintResult.fixedContent!)
            }
          };
        }

      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to generate valid task details after retries: ${error}`);
        }
      }
    }

    throw new Error('Task details generation failed');
  }

  /**
   * Parse specification markdown into structured format
   */
  private async parseSpecification(markdown: string) {
    const sections = markdown.split(/^#+ /m);
    
    let architecture = '';
    let specifications = '';
    const ambiguities: Array<{field: string, question: string}> = [];

    for (const section of sections) {
      const lines = section.trim().split('\n');
      if (lines.length === 0) continue;
      
      const title = lines[0].toLowerCase();
      const content = lines.slice(1).join('\n').trim();

      if (title.includes('architecture')) {
        architecture = content;
      } else if (title.includes('specification') || title.includes('requirement')) {
        specifications = content;
      } else if (content.includes('[NEEDS CLARIFICATION')) {
        // Extract ambiguities
        const ambiguityMatches = content.match(/\[NEEDS CLARIFICATION:([^\]]+)\]/g);
        if (ambiguityMatches) {
          ambiguityMatches.forEach(match => {
            const question = match.replace('[NEEDS CLARIFICATION:', '').replace(']', '');
            ambiguities.push({ field: 'general', question });
          });
        }
      }
    }

    return { architecture, specifications, ambiguities };
  }

  /**
   * Parse task list markdown into structured format
   */
  private async parseTaskList(markdown: string) {
    const tasks = [];
    
    // Extract numbered or lettered tasks
    const taskLines = markdown.split('\n').filter(line => 
      /^\s*[T]\d+\b/.test(line.trim()) || // T001, T002, etc.
      /^\s*\d+\.\b/.test(line.trim()) ||  // 1., 2., etc.
      /^\s*-\s*\[?\]?/.test(line.trim())   // - [ ] or -
    );

    for (const line of taskLines) {
      const trimmed = line.trim();
      
      // Extract T-number and description
      const taskMatch = trimmed.match(/([T]\d+)\s*(.*)/);
      if (taskMatch) {
        tasks.push({
          id: taskMatch[1],
          title: taskMatch[2].replace(/^\s*[-\[\]]+\s*/, ''), // Remove checkbox
          description: taskMatch[2],
          type: this.categorizeTask(taskMatch[2]),
          dependencies: [],
          parallelizable: trimmed.includes('[P]'),
          estimatedHours: this.estimateTaskDuration(taskMatch[2])
        });
      }
    }

    return tasks;
  }

  /**
   * Categorize task type based on description
   */
  private categorizeTask(description: string): 'setup' | 'testing' | 'implementation' | 'integration' | 'polish' {
    const desc = description.toLowerCase();
    
    if (desc.includes('test') || desc.includes('contract')) return 'testing';
    if (desc.includes('setup') || desc.includes('config') || desc.includes('init')) return 'setup';
    if (desc.includes('model') || desc.includes('service') || desc.includes('endpoint')) return 'implementation';
    if (desc.includes('integration') || desc.includes('database') || desc.includes('api')) return 'integration';
    if (desc.includes('polish') || desc.includes('unit test') || desc.includes('documentation')) return 'polish';
    
    return 'implementation'; // Default
  }

  /**
   * Estimate task duration based on complexity indicators
   */
  private estimateTaskDuration(description: string): number {
    const desc = description.toLowerCase();
    
    if (desc.includes('setup') || desc.includes('config')) return 1;
    if (desc.includes('test') && desc.includes('[P]')) return 2; // Parallel tests
    if (desc.includes('model') || desc.includes('service')) return 3;
    if (docstring.includes('endpoint') || docstring.includes('api')) return 4;
    
    return 2; // Default
  }

  /**
   * Validate task structure for TDD compliance and parallel execution
   */
  private validateTaskStructure(tasks: any[]) {
    const testTasks = tasks.filter(t => t.type === 'testing');
    const implementationTasks = tasks.filter(t => t.type === 'implementation' || t.type === 'integration');
    
    // Check if tests come before implementation (TDD compliance)
    const testFirstCompliance = this.checkTestOrder(tasks);
    
    // Validate parallel execution markings
    const parallelExecutionValid = tasks.every(task => {
      if (task.parallelizable) {
        return !this.hasFileConflicts(tasks, task.id);
      }
      return true;
    });

    // Calculate completeness score
    const totalTasks = tasks.length;
    const requiredTypes = ['setup', 'testing', 'implementation'];
    const hasAllRequiredTypes = requiredTypes.every(type => 
      tasks.some(t => t.type === type)
    );

    return {
      testFirstCompliance,
      parallelExecutionValid: testFirstCompliance && parallelExecutionValid,
      completenessScore: hasAllRequiredTypes ? 90 : Math.min((totalTasks / 10) * 100, 80)
    };
  }

  /**
   * Check if tests come before implementation tasks (TDD order)
   */
  private checkTestOrder(tasks: any[]): boolean {
    const testIndices = tasks
      .filter(t => t.type === 'testing')
      .map((t, i) => tasks.findIndex(task => task.id === t.id));
    
    const implementationIndices = tasks
      .filter(t => t.type === 'implementation' || t.type === 'integration')
      .map((t, i) => tasks.findIndex(task => task.id === t.id));

    // All test indices should be before implementation indices
    const maxTestIndex = Math.max(...testIndices);
    const minImplementationIndex = Math.min(...implementationIndices);

    return maxTestIndex < minImplementationIndex;
  }

  /**
   * Check for file conflicts in parallel tasks
   */
  private hasFileConflicts(tasks: any[], taskId: string): boolean {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.parallelizable) return false;

    const parallelTasks = tasks.filter(t => t.id !== taskId && t.parallelizable);
    
    // Simple heuristic: check if tasks mention similar file patterns
    const taskFiles = this.extractFilePatterns(task.description);
    
    return parallelTasks.some(parallelTask => {
      const otherFiles = this.extractFilePatterns(parallelTask.description);
      return taskFiles.some(file => 
        otherFiles.some(otherFile => file === otherFile || file.includes(otherFile))
      );
    });
  }

  /**
   * Extract file patterns from task description
   */
  private extractFilePatterns(description: string): string[] {
    const patterns = [];
    
    // Common file path patterns
    if (description.includes('src/')) {
      const srcMatch = description.match(/src\/[^\s\)]+/g);
      if (srcMatch) patterns.push(...srcMatch);
    }
    
    if (description.includes('tests/')) {
      const testMatch = description.match(/tests\/[^\s\)]+/g);
      if (testMatch) patterns.push(...testMatch);
    }

    return patterns;
  }

  /**
   * Check if task details contain test-driven development guidance
   */
  private containsTestGuidance(content: string): boolean {
    const testKeywords = ['test first', 'tdd', 'red green refactor', 'failing tests', 'write test'];
    return testKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );
  }

  /**
   * Calculate technical completeness score
   */
  private async calculateTechnicalCompleteness(content: string): Promise<number> {
    const sections = [
      'implementation steps',
      'technical requirements', 
      'acceptance criteria',
      'dependencies'
    ];

    let score = 0;
    sections.forEach(section => {
      if (content.toLowerCase().includes(section)) {
        score += 25;
      }
    });

    return Math.min(score, 100);
  }

  /**
   * Extract implementation guidelines from content
   */
  private extractImplementationGuidelines(content: string): string[] {
    const guidelines = [];
    
    // Extract bullet points that look like implementation steps
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if ((trimmed.startsWith('-') || trimmed.startsWith('*')) && 
          (trimmed.includes('implement') || trimmed.includes('create') || trimmed.includes('add'))) {
        guidelines.push(trimmed.substring(1).trim());
      }
    }

    return guidelines.slice(0, 5); // Return top 5 guidelines
  }

  /**
   * Calculate overall quality score for specification
   */
  private async calculateQualityScore(content: string): Promise<number> {
    let score = 0;
    
    // Check for required sections
    const requiredSections = ['user scenarios', 'requirements', 'acceptance criteria'];
    requiredSections.forEach(section => {
      if (content.toLowerCase().includes(section)) score += 30;
    });

    // Check for ambiguity markers
    const hasAmbiguityMarkers = content.includes('[NEEDS CLARIFICATION');
    if (!hasAmbiguityMarkers) score += 10; // Bonus for clarity

    return Math.min(score, 100);
  }

  /**
   * Generate feature name from PRD
   */
  private generateFeatureName(prd: string): string {
    const words = prd.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => 
      word.length > 3 && 
      !['with', 'for', 'the', 'and', 'that', 'this'].includes(word)
    );
    
    const featureName = keywords.slice(0, 3).join('-');
    return featureName.charAt(0).toUpperCase() + featureName.slice(1);
  }

}

// Export singleton instance for easy use
export const specKitIntegration = new SpecKitIntegration();

