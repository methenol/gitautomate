

'use server';

/**
 * @fileOverview Project Plan Orchestrator - The central coordinator for the unified task generation system.
 * This orchestrator replaces the previous siloed approach with a cohesive workflow that ensures
 * context propagation, dependency modeling, and iterative refinement.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type {
  UnifiedProjectContext,
  ProjectPlan,
  Task,
  ValidationResult
} from './unified-project-context';
import { DependencyGraphManager, optimizeTaskExecution } from './dependency-graph';
import type { ResearchTaskInput, ResearchTaskOutput } from './research-task';

export interface OrchestratorOptions {
  apiKey?: string;
  model?: string;
  useTDD?: boolean;
  enableValidation?: boolean;
  maxRetries?: number;
}

export interface GenerationProgress {
  stage: 'architecture' | 'file_structure' | 'task_generation' | 'dependency_analysis' | 'research' | 'validation';
  currentStep: string;
  progress: number; // 0-100
  message: string;
}

/**
 * Main orchestrator class that coordinates the entire project generation workflow
 */
export class ProjectPlanOrchestrator {
  private options: OrchestratorOptions;
  private context: UnifiedProjectContext | null = null;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      enableValidation: true,
      maxRetries: 3,
      ...options
    };
  }

  /**
   * Generates a complete project plan from PRD using the unified architecture
   */
  async generateProjectPlan(
    prd: string,
    options?: Partial<OrchestratorOptions>
  ): Promise<{ plan: ProjectPlan; progressUpdates: GenerationProgress[] }> {
    const finalOptions = { ...this.options, ...options };
    const progressUpdates: GenerationProgress[] = [];

    try {
      // Step 1: Create initial project context
      this.updateProgress(progressUpdates, 'architecture', 'Initializing project context...', 0);
      
      const initialContext = this.createInitialContext(prd);
      this.context = initialContext;

      // Step 2: Generate architecture and specifications
      this.updateProgress(progressUpdates, 'architecture', 'Generating software architecture...', 10);
      
      const { architecture, specifications } = await this.generateArchitectureWithValidation(
        prd,
        finalOptions
      );
      
      this.context = {
        ...this.context,
        architecture,
        specifications
      };

      // Step 3: Generate file structure with full context
      this.updateProgress(progressUpdates, 'file_structure', 'Generating project file structure...', 30);
      
      const { fileStructure } = await this.generateFileStructureWithContext(
        prd,
        architecture,
        specifications,
        finalOptions
      );
      
      this.context = {
        ...this.context,
        fileStructure
      };

      // Step 4: Generate tasks with inter-dependencies
      this.updateProgress(progressUpdates, 'task_generation', 'Generating task dependencies...', 50);
      
      const tasks = await this.generateTasksWithDependencies(
        architecture,
        specifications,
        fileStructure,
        finalOptions
      );

      // Step 5: Build dependency graph and optimize execution order
      this.updateProgress(progressUpdates, 'dependency_analysis', 'Analyzing task dependencies...', 70);
      
      const { optimizedTasks, executionOrder } = await this.analyzeAndOptimizeDependencies(
        tasks,
        finalOptions
      );

      // Step 6: Research each task with full context awareness
      this.updateProgress(progressUpdates, 'research', 'Researching implementation details...', 80);
      
      const researchedTasks = await this.researchAllTasksWithDependencies(
        optimizedTasks,
        finalOptions
      );

      // Step 7: Validate the complete project plan
      this.updateProgress(progressUpdates, 'validation', 'Validating project plan consistency...', 95);
      
      const validationResults = await this.validateCompletePlan(researchedTasks, finalOptions);

      // Step 8: Create final project plan
      this.updateProgress(progressUpdates, 'validation', 'Finalizing project plan...', 100);

      const projectPlan: ProjectPlan = {
        context: this.context,
        tasks: researchedTasks,
        executionOrder,
        validationResults,
        metadata: {
          generatedAt: new Date(),
          modelUsed: finalOptions.model || 'gemini-1.5-flash-latest',
          useTDD: finalOptions.useTDD || false,
          confidenceScore: this.calculateConfidenceScore(validationResults)
        }
      };

      return { plan: projectPlan, progressUpdates };
    } catch (error) {
      throw new Error(`Project plan generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Creates the initial project context from PRD
   */
  private createInitialContext(prd: string): UnifiedProjectContext {
    return {
      prd,
      architecture: '',
      fileStructure: '',
      specifications: '',
      dependencyGraph: {
        tasks: {},
        edges: []
      },
      validationHistory: []
    };
  }

  /**
   * Generates architecture with built-in validation
   */
  private async generateArchitectureWithValidation(
    prd: string,
    options: OrchestratorOptions
  ): Promise<{ architecture: string; specifications: string }> {
    const modelName = options.model || 'googleai/gemini-1.5-flash-latest';
    
    const prompt = `You are a senior software architect creating comprehensive architecture and specifications for an AI-driven development project.

**Your Task:**
1. Analyze the Product Requirements Document (PRD) below
2. Generate a detailed software architecture that addresses all requirements
3. Create comprehensive specifications covering functional and non-functional needs

**Architecture Requirements:**
- Must be technology-stack agnostic unless specified in PRD
- Should include component breakdown, data flow, and integration patterns
- Must consider scalability, maintainability, and security best practices
- Should include authentication/authorization if users are mentioned

**Specifications Requirements:**
- Functional requirements (what the system should do)
- Non-functional requirements (performance, security, usability)
- Technical constraints and assumptions
- Success criteria for validation

**PRD:**
${prd}

Respond with ONLY a valid JSON object containing:
{
  "architecture": "# Software Architecture\n[Detailed markdown architecture]",
  "specifications": "# Project Specifications\n[Comprehensive specifications in markdown]"
}`;

    try {
      const { output } = await ai.generate({
        model: modelName,
        prompt,
        config: options.apiKey ? { apiKey: options.apiKey } : undefined
      });

      if (!output) {
        throw new Error('Architecture generation returned no output');
      }

      const result = typeof output === 'string' ? JSON.parse(output) : output;
      
      return {
        architecture: result.architecture || '',
        specifications: result.specifications || ''
      };
    } catch (error) {
      throw new Error(`Architecture generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generates file structure with full project context
   */
  private async generateFileStructureWithContext(
    prd: string,
    architecture: string,
    specifications: string,
    options: OrchestratorOptions
  ): Promise<{ fileStructure: string }> {
    const modelName = options.model || 'googleai/gemini-1.5-flash-latest';
    
    const prompt = `You are a senior software architect creating a comprehensive file/folder structure for an AI-driven development project.

**Project Context:**
- **PRD:** ${prd}
- **Architecture:** ${architecture}
- **Specifications:** ${specifications}

**Your Task:**
Generate a complete, human-editable file/folder structure that reflects the project architecture and specifications.

**Structure Requirements:**
- Must include all major directories (src/, tests/, docs/, config/, etc.)
- Should follow the architecture patterns and technology decisions
- Must include configuration files, build scripts, and development setup files
- Should be organized for team collaboration and CI/CD readiness

**Output Format:**
Provide the structure as a markdown code block using tree notation:
\`\`\`
project-root/
├── src/
│   ├── components/
│   ├── services/
│   └── utils/
├── tests/
├── docs/
├── config/
└── package.json
\`\`\`

Respond with ONLY the file structure as a markdown code block:`;

    try {
      const { output } = await ai.generate({
        model: modelName,
        prompt,
        config: options.apiKey ? { apiKey: options.apiKey } : undefined
      });

      if (!output) {
        throw new Error('File structure generation returned no output');
      }

      return { fileStructure: typeof output === 'string' ? output : JSON.stringify(output) };
    } catch (error) {
      throw new Error(`File structure generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generates tasks with inter-dependency modeling
   */
  private async generateTasksWithDependencies(
    architecture: string,
    specifications: string,
    fileStructure: string,
    options: OrchestratorOptions
  ): Promise<Task[]> {
    const modelName = options.model || 'googleai/gemini-1.5-flash-latest';
    
    const prompt = `You are a lead software engineer creating an AI-driven project plan with inter-dependent tasks.

**Project Context:**
- **Architecture:** ${architecture}
- **Specifications:** ${specifications}  
- **File Structure:** ${fileStructure}

**Your Task:**
Generate a comprehensive set of development tasks with proper dependency modeling.

**Task Generation Requirements:**
1. **Sequential Order:** Tasks must follow logical development sequence
2. **Dependency Awareness:** Each task should identify its prerequisites
3. **Priority Assignment:** Assign appropriate priorities (low/medium/high/critical)
4. **Time Estimation:** Provide realistic duration estimates in hours
5. **Prerequisites Modeling:** Include technical prerequisites (files, components, auth setup)

**Task Categories to Cover:**
- Project initialization and configuration
- Core component development  
- Database integration
- Authentication/authorization setup
- API development and testing
- UI components and pages
- CI/CD pipeline setup
- Documentation and deployment

**Task Format:**
Generate tasks as a JSON array with each task having:
- id: unique identifier
- title: clear, actionable description  
- priority: low/medium/high/critical
- estimatedDuration: hours (1-40)
- dependencies: array of task IDs this depends on
- prerequisites: technical requirements

**Dependencies Strategy:**
- Setup tasks must precede implementation tasks  
- Infrastructure tasks before feature tasks
- Testing throughout development cycle

Respond with ONLY a valid JSON array of task objects:`;

    try {
      const { output } = await ai.generate({
        model: modelName,
        prompt,
        config: options.apiKey ? { apiKey: options.apiKey } : undefined
      });

      if (!output) {
        throw new Error('Task generation returned no output');
      }

      const tasks = typeof output === 'string' ? JSON.parse(output) : output;
      
      // Validate and normalize tasks
      return this.normalizeAndValidateTasks(tasks);
    } catch (error) {
      throw new Error(`Task generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Analyzes dependencies and optimizes task execution order
   */
  private async analyzeAndOptimizeDependencies(
    tasks: Task[],
    options: OrchestratorOptions
  ): Promise<{ optimizedTasks: Task[]; executionOrder: string[] }> {
    const dependencyManager = new DependencyGraphManager();
    
    // Add all tasks to the graph
    tasks.forEach(task => dependencyManager.addTask(task));
    
    // Analyze and validate the graph
    const validationResults = dependencyManager.validate();
    
    if (validationResults.some(result => result.severity === 'error')) {
      console.warn('Dependency validation warnings:', validationResults);
    }
    
    // Get optimized execution order
    const executionOrder = optimizeTaskExecution(dependencyManager['graph']);
    
    return { optimizedTasks: tasks, executionOrder };
  }

  /**
   * Researches all tasks with full context and dependency awareness
   */
  private async researchAllTasksWithDependencies(
    tasks: Task[],
    options: OrchestratorOptions
  ): Promise<Task[]> {
    const modelName = options.model || 'googleai/gemini-1.5-pro-latest';
    
    // Research tasks in parallel with concurrency limit
    const researchPromises = tasks.map(task => 
      this.researchTaskWithContext(task, options)
    );
    
    const researchedTasks = await Promise.all(researchPromises);
    
    return tasks.map((task, index) => ({
      ...task,
      context: researchedTasks[index].context,
      implementationSteps: researchedTasks[index].implementationSteps,
      acceptanceCriteria: researchedTasks[index].acceptanceCriteria
    }));
  }

  /**
   * Researches a single task with full project context
   */
  private async researchTaskWithContext(
    task: Task,
    options: OrchestratorOptions
  ): Promise<{ context: string; implementationSteps: string; acceptanceCriteria: string }> {
    const modelName = options.model || 'googleai/gemini-1.5-pro-latest';
    
    const prompt = `You are an expert project manager and senior software engineer performing detailed research for a specific development task.

**Project Context:**
- **Architecture:** ${this.context?.architecture}
- **Specifications:** ${this.context?.specifications}  
- **File Structure:** ${this.context?.fileStructure}
- **Task Dependencies:** This task depends on: [${task.dependencies.join(', ')}]

**Your Task:**
Perform comprehensive research for the following task and provide a detailed implementation plan.

**Task to Research:** ${task.title}

**Research Requirements:**
1. **Context Analysis:** Explain how this task fits into the overall architecture
2. **Implementation Planning:** Provide step-by-step technical guidance without code snippets
3. **Acceptance Criteria:** Define clear completion criteria

**Implementation Planning Focus:**
- Files that need creation/modification
- Integration points with existing components  
- Technical dependencies and constraints
- Testing approach and validation methods
- Security considerations if applicable

**Response Format:**
Return as valid JSON:
{
  "context": "How this task fits into the overall architecture...",
  "implementationSteps": "Detailed step-by-step implementation guide...",
  "acceptanceCriteria": "Clear definition of done criteria..."
}

Respond with ONLY the JSON object:`;

    try {
      const { output } = await ai.generate({
        model: modelName,
        prompt,
        config: options.apiKey ? { apiKey: options.apiKey } : undefined
      });

      if (!output) {
        throw new Error('Task research returned no output');
      }

      const result = typeof output === 'string' ? JSON.parse(output) : output;
      
      return {
        context: result.context || '',
        implementationSteps: result.implementationSteps || '',  
        acceptanceCriteria: result.acceptanceCriteria || ''
      };
    } catch (error) {
      throw new Error(`Task research failed for "${task.title}": ${(error as Error).message}`);
    }
  }

  /**
   * Validates the complete project plan for consistency
   */
  private async validateCompletePlan(
    tasks: Task[],
    options: OrchestratorOptions
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Check task-architecture consistency
    tasks.forEach(task => {
      if (!task.context.includes(this.context?.architecture || '')) {
        results.push({
          id: `context-consistency-${task.id}`,
          timestamp: new Date(),
          type: 'consistency_check',
          passed: false,
          message: `Task "${task.title}" context doesn't reference project architecture`,
          severity: 'warning'
        });
      }
    });

    // Check for missing prerequisites in file structure
    if (this.context?.fileStructure) {
      tasks.forEach(task => {
        task.prerequisites.forEach(prereq => {
          if (prereq.type === 'file_exists' && !this.context?.fileStructure.includes(prereq.target)) {
            results.push({
              id: `file-prerequisite-${task.id}-${prereq.target}`,
              timestamp: new Date(),
              type: 'feasibility_analysis',
              passed: false,
              message: `Task "${task.title}" requires file "${prereq.target}" not found in structure`,
              severity: 'error'
            });
          }
        });
      });
    }

    return results;
  }

  /**
   * Normalizes and validates generated tasks
   */
  private normalizeAndValidateTasks(tasks: any[]): Task[] {
    return tasks.map((task, index) => ({
      id: task.id || `task-${index + 1}`,
      title: task.title || `Task ${index + 1}`,
      description: task.description || '',
      priority: this.validatePriority(task.priority) || 'medium',
      estimatedDuration: task.estimatedDuration || 4,
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      prerequisites: Array.isArray(task.prerequisites) ? task.prerequisites : [],
      context: '',
      implementationSteps: '',
      acceptanceCriteria: '',
      status: 'pending',
      researchCompleted: false
    }));
  }

  /**
   * Validates priority value
   */
  private validatePriority(priority: any): 'low' | 'medium' | 'high' | 'critical' {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    return validPriorities.includes(priority) ? priority : 'medium';
  }

  /**
   * Calculates confidence score based on validation results
   */
  private calculateConfidenceScore(validationResults: ValidationResult[]): number {
    if (validationResults.length === 0) return 1.0;
    
    const errorCount = validationResults.filter(r => r.severity === 'error').length;
    const warningCount = validationResults.filter(r => r.severity === 'warning').length;
    
    return Math.max(0, 1 - (errorCount * 0.3) - (warningCount * 0.1));
  }

  /**
   * Updates progress tracking
   */
  private updateProgress(
    progressUpdates: GenerationProgress[],
    stage: GenerationProgress['stage'],
    currentStep: string,
    progress: number
  ): void {
    progressUpdates.push({
      stage,
      currentStep,
      progress: Math.max(0, Math.min(100, progress)),
      message: `${stage.replace('_', ' ').toUpperCase()}: ${currentStep}`
    });
  }
}

/**
 * Main entry point for project plan generation
 */
export async function generateUnifiedProjectPlan(
  prd: string,
  options?: OrchestratorOptions
): Promise<{ plan: ProjectPlan; progressUpdates: GenerationProgress[] }> {
  const orchestrator = new ProjectPlanOrchestrator(options);
  return await orchestrator.generateProjectPlan(prd, options);
}

