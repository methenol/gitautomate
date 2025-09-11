'use server';

/**
 * @fileOverview Comprehensive orchestrator that completely replaces the sequential silo system
 * with proper context propagation, dependency management, and iterative refinement.
 */

import { UnifiedProjectContext } from '@/types/unified-context';
import { EnhancedTaskResearchEngine } from '@/ai/engines/enhanced-task-research';
import { IterativeRefinementEngine } from '@/ai/orchestrator/iterative-refinement';
import { ContextValidator } from '@/ai/validation/context-validator';
import { generateArchitecture } from '@/ai/flows/generate-architecture';
import { generateFileStructure } from '@/ai/flows/generate-file-structure';
import { generateTasks } from '@/ai/flows/generate-tasks';

// Import the type from enhanced-task-research
import { EnhancedResearchOutput } from '@/ai/engines/enhanced-task-research';

export interface ComprehensiveGenerationResult {
  context: UnifiedProjectContext;
  success: boolean;
  consistencyScore: number;
  iterationCount: number;
  errors: string[];
  warnings: string[];
  debugInfo: {
    refinementHistory: string[];
    dependencyResolutions: string[];
    validationSteps: string[];
  };
}

export interface ComprehensiveOptions {
  apiKey?: string;
  apiBase?: string;
  model?: string;
  useTDD?: boolean;
  maxRefinementIterations?: number;
  consistencyThreshold?: number;
}

/**
 * COMPLETE REPLACEMENT for the existing sequential workflow.
 * This orchestrator provides:
 * - Unified context propagation
 * - Iterative refinement until consistency is achieved
 * - Enhanced dependency management
 * - Cross-component validation
 * - Context-aware task research
 */
export class ComprehensiveOrchestrator {
  private researchEngine: EnhancedTaskResearchEngine;
  private refinementEngine: IterativeRefinementEngine;
  
  constructor() {
    this.researchEngine = new EnhancedTaskResearchEngine();
    this.refinementEngine = new IterativeRefinementEngine();
  }

  /**
   * Generate a complete, consistent project plan with iterative refinement
   */
  async generateComprehensiveProject(
    prd: string,
    options: ComprehensiveOptions = {}
  ): Promise<ComprehensiveGenerationResult> {
    
    const {
      apiKey,
      apiBase,
      model,
      useTDD = false,
      maxRefinementIterations = 3,
      consistencyThreshold = 85
    } = options;

    const debugInfo = {
      refinementHistory: [] as string[],
      dependencyResolutions: [] as string[],
      validationSteps: [] as string[],
    };

    let context: UnifiedProjectContext = {
      prd,
      architecture: '',
      fileStructure: '',
      specifications: '',
      tasks: [],
      dependencyGraph: [],
      validationHistory: [],
      lastUpdated: new Date().toISOString(),
      version: 1,
    };

    let iterationCount = 0;
    let consistencyScore = 0;

    try {
      // Phase 1: Initial Generation
      debugInfo.validationSteps.push('Phase 1: Initial architecture and specification generation');
      
      const archResult = await generateArchitecture(
        { prd },
        apiKey,
        model,
        apiBase
      );
      
      context.architecture = archResult.architecture;
      context.specifications = archResult.specifications;
      debugInfo.validationSteps.push('Generated initial architecture and specifications');

      // Phase 2: File Structure Generation with Architecture Context
      debugInfo.validationSteps.push('Phase 2: File structure generation with architecture context');
      
      console.log(`Phase 2 - Starting file structure generation`);
      console.log(`PRD length: ${context.prd.length}`);
      console.log(`Architecture length: ${context.architecture.length}`);
      console.log(`Specifications length: ${context.specifications.length}`);
      
      const fileStructResult = await generateFileStructure(
        {
          prd: context.prd,
          architecture: context.architecture,
          specifications: context.specifications
        },
        apiKey,
        model,
        apiBase
      );
      
      console.log(`Phase 2 - File structure result length: ${fileStructResult.fileStructure?.length || 0}`);
      context.fileStructure = fileStructResult.fileStructure || '';
      debugInfo.validationSteps.push('Generated file structure aligned with architecture');

      // Phase 3: Enhanced Task Generation with Full Context
      debugInfo.validationSteps.push('Phase 3: Enhanced task generation with dependency modeling');
      
      console.log(`Phase 3 - Starting task generation`);
      console.log(`Architecture length: ${context.architecture.length}`);
      console.log(`Specifications length: ${context.specifications.length}`);
      console.log(`File structure length: ${context.fileStructure.length}`);
      
      const tasksResult = await generateTasks(
        {
          architecture: context.architecture,
          specifications: context.specifications,
          fileStructure: context.fileStructure
        },
        apiKey,
        model,
        apiBase,
        useTDD
      );

      console.log(`Phase 3 - Tasks result: ${tasksResult.tasks?.length || 0} tasks generated`);
      
      // Transform tasks with enhanced dependency analysis
      context.tasks = await this.generateEnhancedTasks(tasksResult.tasks, context, debugInfo);
      context.dependencyGraph = this.buildComprehensiveDependencyGraph(context.tasks);
      debugInfo.dependencyResolutions.push(`Generated ${context.tasks.length} tasks with ${context.dependencyGraph.length} dependencies`);
      console.log(`Phase 3 - Final context has ${context.tasks.length} tasks`);

      // Phase 4: Iterative Refinement Loop
      debugInfo.validationSteps.push('Phase 4: Iterative consistency refinement');
      
      console.log(`Starting iterative refinement with ${context.tasks.length} tasks`);
      console.log(`Architecture length: ${context.architecture.length}`);
      console.log(`File structure length: ${context.fileStructure.length}`);
      console.log(`Specifications length: ${context.specifications.length}`);
      
      for (let i = 0; i < maxRefinementIterations; i++) {
        iterationCount = i + 1;
        
        console.log(`Starting refinement iteration ${iterationCount}`);
        
        // Analyze consistency
        const analysis = await this.refinementEngine.analyzeProjectConsistency(context, apiKey, apiBase, model);
        consistencyScore = analysis.overallConsistency;
        
        debugInfo.refinementHistory.push(
          `Iteration ${iterationCount}: Consistency score ${consistencyScore}/100, ` +
          `${analysis.criticalIssues.length} critical issues, ` +
          `action: ${analysis.recommendedAction}`
        );

        console.log(`Analysis result - Score: ${consistencyScore}, Issues: ${analysis.criticalIssues.length}, Action: ${analysis.recommendedAction}`);

        // Check if we've achieved acceptable consistency
        if (consistencyScore >= consistencyThreshold && analysis.criticalIssues.length === 0) {
          debugInfo.refinementHistory.push(`Consistency threshold reached in ${iterationCount} iterations`);
          console.log(`Consistency threshold reached, stopping refinement`);
          break;
        }

        // Apply refinements
        context = await this.refinementEngine.applyRefinements(context, analysis, apiKey, apiBase, model);
        
        // Regenerate dependency graph after refinements
        context.dependencyGraph = this.buildComprehensiveDependencyGraph(context.tasks);
        
        debugInfo.refinementHistory.push(`Applied ${analysis.suggestions.length} refinements`);
        console.log(`Applied ${analysis.suggestions.length} refinements, continuing to next iteration`);
      }

      // Phase 5: Enhanced Task Research with Full Context Propagation
      debugInfo.validationSteps.push('Phase 5: Enhanced task research with context propagation');
      
      context = await this.performEnhancedTaskResearch(context, apiKey, apiBase, model, debugInfo);

      // Phase 6: Final Validation
      debugInfo.validationSteps.push('Phase 6: Final comprehensive validation');
      
      const finalValidation = ContextValidator.validateFullContext(context);
      context.validationHistory = finalValidation;

      const errors = finalValidation.filter(v => v.severity === 'error').flatMap(v => v.issues);
      const warnings = finalValidation.filter(v => v.severity === 'warning').flatMap(v => v.issues);

      context.lastUpdated = new Date().toISOString();
      
      return {
        context,
        success: errors.length === 0 && consistencyScore >= consistencyThreshold,
        consistencyScore,
        iterationCount,
        errors,
        warnings,
        debugInfo,
      };

    } catch (error) {
      return {
        context,
        success: false,
        consistencyScore: 0,
        iterationCount,
        errors: [(error as Error).message],
        warnings: [],
        debugInfo,
      };
    }
  }

  /**
   * Research tasks with full context awareness and dependency propagation
   */
  private async performEnhancedTaskResearch(
    context: UnifiedProjectContext,
    apiKey?: string,
    apiBase?: string,
    model?: string,
    debugInfo?: { dependencyResolutions: string[]; validationSteps: string[]; refinementHistory: string[] }
  ): Promise<UnifiedProjectContext> {
    
    const orderedTasks = this.topologicalSort(context.tasks);
    const completedTaskIds: string[] = [];
    const updatedTasks = [...context.tasks];

    debugInfo?.validationSteps.push(`Researching ${orderedTasks.length} tasks in dependency order`);

    for (const task of orderedTasks) {
      try {
        // Enhanced research with full context
        const enhancedResearchResult = await this.researchEngine.researchWithFullContext(
          task,
          context,
          completedTaskIds,
          apiKey,
          apiBase,
          model
        );

        // Validate research consistency
        const consistencyIssues = await this.researchEngine.validateTaskConsistency(
          task,
          context,
          enhancedResearchResult
        );

        // Format enhanced details
        const enhancedDetails = this.formatEnhancedTaskDetails(enhancedResearchResult, consistencyIssues);
        
        // Update task with research results
        const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
        updatedTasks[taskIndex] = {
          ...task,
          details: enhancedDetails,
          status: 'completed',
          // Update dependencies based on discoveries
          dependencies: [
            ...task.dependencies,
            ...enhancedResearchResult.discoveredDependencies.filter(dep => 
              context.tasks.some(t => t.id === dep || t.title.toLowerCase().includes(dep.toLowerCase()))
            )
          ]
        };

        completedTaskIds.push(task.id);
        debugInfo?.dependencyResolutions.push(
          `Researched ${task.title}: ${consistencyIssues.length} consistency issues, ` +
          `${enhancedResearchResult.discoveredDependencies.length} new dependencies`
        );

      } catch (error) {
        const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
        updatedTasks[taskIndex] = {
          ...task,
          details: `Enhanced research failed: ${(error as Error).message}`,
          status: 'failed'
        };
        
        debugInfo?.dependencyResolutions.push(`Failed to research ${task.title}: ${(error as Error).message}`);
      }
    }

    return {
      ...context,
      tasks: updatedTasks,
      lastUpdated: new Date().toISOString(),
      version: context.version + 1,
    };
  }

  /**
   * Generate enhanced tasks with sophisticated dependency analysis
   */
  private async generateEnhancedTasks(
    baseTasks: Array<{ title: string; details: string }>,
    context: UnifiedProjectContext,
    debugInfo: { dependencyResolutions: string[]; refinementHistory: string[]; validationSteps: string[] }
  ): Promise<UnifiedProjectContext['tasks']> {
    
    const enhancedTasks = baseTasks.map((task, index) => ({
      ...task,
      id: `task-${(index + 1).toString().padStart(3, '0')}`,
      order: index + 1,
      dependencies: [] as string[],
      status: 'pending' as const,
    }));

    // Advanced dependency inference
    for (let i = 0; i < enhancedTasks.length; i++) {
      const task = enhancedTasks[i];
      const dependencies = this.inferAdvancedDependencies(task, enhancedTasks, i, context);
      task.dependencies = dependencies;
      
      debugInfo.dependencyResolutions.push(
        `${task.id}: ${dependencies.length} dependencies: [${dependencies.join(', ')}]`
      );
    }

    return enhancedTasks;
  }

  /**
   * Advanced dependency inference using context analysis
   */
  private inferAdvancedDependencies(
    task: UnifiedProjectContext['tasks'][0],
    allTasks: UnifiedProjectContext['tasks'],
    currentIndex: number,
    context: UnifiedProjectContext
  ): string[] {
    
    const dependencies: string[] = [];
    const taskLower = task.title.toLowerCase();
    const availableTasks = allTasks.slice(0, currentIndex);

    // Infrastructure dependencies
    if (taskLower.includes('api') || taskLower.includes('endpoint') || taskLower.includes('route')) {
      const setupTasks = availableTasks.filter(t => 
        t.title.toLowerCase().includes('setup') || 
        t.title.toLowerCase().includes('configure') ||
        t.title.toLowerCase().includes('initialize')
      );
      if (setupTasks.length > 0) {
        dependencies.push(setupTasks[setupTasks.length - 1].id);
      }
    }

    // Database dependencies
    if (taskLower.includes('database') || taskLower.includes('model') || taskLower.includes('schema')) {
      const dbSetupTasks = availableTasks.filter(t => 
        t.title.toLowerCase().includes('database setup') ||
        t.title.toLowerCase().includes('db') ||
        t.title.toLowerCase().includes('migration')
      );
      if (dbSetupTasks.length > 0) {
        dependencies.push(dbSetupTasks[dbSetupTasks.length - 1].id);
      }
    }

    // Authentication dependencies
    if (taskLower.includes('user') && !taskLower.includes('setup') && !taskLower.includes('auth')) {
      const authTasks = availableTasks.filter(t => 
        t.title.toLowerCase().includes('auth') ||
        t.title.toLowerCase().includes('login') ||
        t.title.toLowerCase().includes('authentication')
      );
      if (authTasks.length > 0) {
        dependencies.push(authTasks[authTasks.length - 1].id);
      }
    }

    // UI/Component dependencies
    if (taskLower.includes('page') || taskLower.includes('component')) {
      const uiSetupTasks = availableTasks.filter(t => 
        t.title.toLowerCase().includes('ui setup') ||
        t.title.toLowerCase().includes('component library') ||
        t.title.toLowerCase().includes('styling')
      );
      if (uiSetupTasks.length > 0) {
        dependencies.push(uiSetupTasks[uiSetupTasks.length - 1].id);
      }
    }

    // Testing dependencies (tests depend on the features they test)
    if (taskLower.includes('test') && !taskLower.includes('setup')) {
      const featureName = task.title.replace(/test|testing/gi, '').trim();
      const featureTask = availableTasks.find(t => 
        t.title.toLowerCase().includes(featureName.toLowerCase()) &&
        !t.title.toLowerCase().includes('test')
      );
      if (featureTask) {
        dependencies.push(featureTask.id);
      }
    }

    // Architecture-specific dependencies based on context
    if (context.architecture.toLowerCase().includes('microservice')) {
      if (taskLower.includes('service')) {
        const gatewayTasks = availableTasks.filter(t => 
          t.title.toLowerCase().includes('gateway') ||
          t.title.toLowerCase().includes('proxy')
        );
        if (gatewayTasks.length > 0) {
          dependencies.push(gatewayTasks[0].id);
        }
      }
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Build comprehensive dependency graph with cycle detection
   */
  private buildComprehensiveDependencyGraph(tasks: UnifiedProjectContext['tasks']) {
    const graph = tasks.map(task => ({
      taskId: task.id,
      dependsOn: task.dependencies,
      blockedBy: tasks.filter(t => t.dependencies.includes(task.id)).map(t => t.id),
    }));

    // Validate for cycles
    this.detectDependencyCycles(graph);
    
    return graph;
  }

  /**
   * Topological sort with cycle detection
   */
  private topologicalSort(tasks: UnifiedProjectContext['tasks']): UnifiedProjectContext['tasks'] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: UnifiedProjectContext['tasks'] = [];

    const visit = (taskId: string) => {
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected involving task: ${taskId}`);
      }
      if (visited.has(taskId)) return;

      visiting.add(taskId);
      
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.dependencies.forEach(depId => visit(depId));
        visiting.delete(taskId);
        visited.add(taskId);
        result.push(task);
      }
    };

    tasks.forEach(task => {
      if (!visited.has(task.id)) {
        visit(task.id);
      }
    });

    return result;
  }

  /**
   * Detect dependency cycles
   */
  private detectDependencyCycles(graph: Array<{ taskId: string; dependsOn: string[] }>) {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (taskId: string): void => {
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected in task: ${taskId}`);
      }
      if (visited.has(taskId)) return;

      visiting.add(taskId);
      const node = graph.find(n => n.taskId === taskId);
      if (node) {
        node.dependsOn.forEach(depId => visit(depId));
      }
      visiting.delete(taskId);
      visited.add(taskId);
    };

    graph.forEach(node => {
      if (!visited.has(node.taskId)) {
        visit(node.taskId);
      }
    });
  }

  /**
   * Format enhanced task details with rich context
   */
  private formatEnhancedTaskDetails(
    researchResult: EnhancedResearchOutput,
    consistencyIssues: string[]
  ): string {
    const sections = [
      `### Context\n${researchResult.context}`,
      `### Implementation Steps\n${researchResult.implementationSteps}`,
      `### Acceptance Criteria\n${researchResult.acceptanceCriteria}`,
      `### Integration Points\n${researchResult.integrationPoints.map((p: string) => `- ${p}`).join('\n')}`,
      `### Testing Strategy\n${researchResult.testingStrategy}`,
      `### Risk Factors\n${researchResult.riskFactors.map((r: string) => `- ${r}`).join('\n')}`,
      `### Complexity Assessment\n${researchResult.estimatedComplexity.toUpperCase()}`,
    ];

    if (researchResult.discoveredDependencies.length > 0) {
      sections.push(`### Discovered Dependencies\n${researchResult.discoveredDependencies.map((d: string) => `- ${d}`).join('\n')}`);
    }

    if (consistencyIssues.length > 0) {
      sections.push(`### Consistency Issues\n${consistencyIssues.map(i => `- ⚠️ ${i}`).join('\n')}`);
    }

    return sections.join('\n\n');
  }
}