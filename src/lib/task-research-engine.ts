


import { ai } from '@/ai/genkit';

import { z } from 'genkit';
import {
  UnifiedProjectContext,
  EnhancedTask,
  DependencyGraph,
  TaskResearchEngine as ITaskResearchEngine
} from '@/types/unified-project';

/**
 * Dependency-Aware Research Engine - Replaces isolated task research
 * 
 * This class performs comprehensive task research with full awareness of:
 * - Project context and dependencies
 * - Completed tasks for knowledge transfer
 * - Task relationships and sequencing logic
 */
export class TaskResearchEngine implements ITaskResearchEngine {
  private context: UnifiedProjectContext | null = null;
  private dependencyGraph: DependencyGraph | null = null;

  /**
   * Research a single task with full context and dependency awareness
   */
  async researchTaskWithDependencies(
    taskId: string,
    context: UnifiedProjectContext,
    completedTasks: Set<string>,
    dependencyGraph: DependencyGraph
  ): Promise<EnhancedTask> {
    
    this.context = context;
    this.dependencyGraph = dependencyGraph;

    try {
      const task = dependencyGraph.tasks[taskId];
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found in dependency graph`);
      }

      // Get context from completed dependencies
      const dependencyContext = await this.extractDependencyContext(taskId, completedTasks);
      
      // Get project-level context
      const projectContext = this.extractProjectContext(task, dependencyGraph);
      
      // Generate research with all context combined
      const researchedTask = await this.generateDetailedResearch(
        task,
        dependencyContext,
        projectContext
      );

      // Validate the research against current context
      await this.validateResearch(researchedTask, dependencyGraph);

      return researchedTask;
    } catch (error) {
      console.error(`Error researching task ${taskId}:`, error);
      
      // Return fallback research
      return await this.generateFallbackResearch(taskId, context, dependencyGraph);
    }
  }

  /**
   * Research multiple tasks in parallel with context sharing
   */
  async researchTasksWithBatchContext(
    taskIds: string[],
    context: UnifiedProjectContext,
    completedTasks: Set<string>,
    dependencyGraph: DependencyGraph
  ): Promise<EnhancedTask[]> {
    
    const results: EnhancedTask[] = [];
    
    // Group tasks by their dependency levels to optimize parallel processing
    const taskGroups = this.groupTasksByDependencyLevel(taskIds, dependencyGraph);
    
    // Process each group (tasks with same dependency level can be researched in parallel)
    for (const taskGroup of Object.values(taskGroups).sort()) {
      const researchPromises = taskGroup.map(async (taskId) => {
        return this.researchTaskWithDependencies(
          taskId,
          context,
          completedTasks,
          dependencyGraph
        );
      });

      const groupResults = await Promise.allSettled(researchPromises);
      
      // Add successful results, handle failures gracefully
      groupResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          
          // Add this task to completed tasks for subsequent research
          const originalTaskId = taskGroup[index];
          if (result.value.id === originalTaskId) {
            completedTasks.add(originalTaskId);
          }
        } else {
          console.error(`Failed to research task ${taskGroup[index]}:`, result.reason);
          
          // Generate fallback for failed tasks
          this.generateFallbackResearch(taskGroup[index], context, dependencyGraph)
            .then(fallbackTask => {
              results.push(fallbackTask);
              completedTasks.add(taskGroup[index]);
            })
            .catch(error => {
              console.error(`Failed to generate fallback for task ${taskGroup[index]}:`, error);
            });
        }
      });

      // Small delay between groups to avoid rate limiting
      if (taskGroup.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Extract context from completed dependencies
   */
  private async extractDependencyContext(
    taskId: string,
    completedTasks: Set<string>
  ): Promise<Record<string, any>> {
    
    const context: Record<string, any> = {};
    
    if (!this.dependencyGraph) return context;

    const task = this.dependencyGraph.tasks[taskId];
    if (!task) return context;

    // Get information from completed dependencies
    const completedDependencies = task.dependencies.filter(depId => 
      completedTasks.has(depId) && this.dependencyGraph!.tasks[depId]
    );

    if (completedDependencies.length > 0) {
      context.completedTasks = completedDependencies.map(depId => ({
        id: depId,
        title: this.dependencyGraph!.tasks[depId].title,
        acceptanceCriteria: this.dependencyGraph!.tasks[depId].acceptanceCriteria
      }));
    }

    // Extract insights from completed tasks that might inform current task
    context.insights = this.extractInsightsFromCompletedTasks(completedDependencies);

    return context;
  }

  /**
   * Extract project-level context for task research
   */
  private extractProjectContext(
    task: EnhancedTask,
    dependencyGraph: DependencyGraph
  ): Record<string, any> {
    
    const context: Record<string, any> = {};

    // Add task's position in dependency chain
    const dependentTasks = Object.values(dependencyGraph.tasks)
      .filter(t => t.dependencies.includes(task.id));
    
    if (dependentTasks.length > 0) {
      context.dependentTasks = dependentTasks.map(t => ({
        id: t.id,
        title: t.title
      }));
    }

    // Add task category context
    const sameCategoryTasks = Object.values(dependencyGraph.tasks)
      .filter(t => t.category === task.category && t.id !== task.id);
    
    if (sameCategoryTasks.length > 0) {
      context.similarTasks = sameCategoryTasks.slice(0, 3).map(t => ({
        id: t.id,
        title: t.title
      }));
    }

    // Add project-wide constraints and patterns
    context.projectConstraints = this.extractProjectConstraints(dependencyGraph);

    return context;
  }

  /**
   * Generate detailed research with all available context
   */
  private async generateDetailedResearch(
    task: EnhancedTask,
    dependencyContext: Record<string, any>,
    projectContext: Record<string, any>
  ): Promise<EnhancedTask> {
    
    const researchPrompt = this.buildResearchPrompt(
      task,
      dependencyContext,
      projectContext
    );

    try {
      const { output } = await ai.generate({
        model: 'googleai/gemini-1.5-pro-latest',
        prompt: researchPrompt,
        output: {
          schema: z.object({
            context: z.string().describe('How this task fits into the overall architecture and project'),
            implementationSteps: z.string().describe('Detailed step-by-step implementation guide'),
            acceptanceCriteria: z.string().describe('Clear criteria for task completion')
          })
        }
      });

      if (!output) {
        throw new Error('No research output generated');
      }

      return {
        ...task,
        context: output.context || task.context,
        implementationSteps: output.implementationSteps || '',
        acceptanceCriteria: output.acceptanceCriteria || ''
      };
    } catch (error) {
      console.error('Error generating detailed research:', error);
      
      // Return task with basic context
      return {
        ...task,
        implementationSteps: 'Implementation steps need to be defined based on the project context.',
        acceptanceCriteria: 'Task completion criteria need to be specified.'
      };
    }
  }

  /**
   * Build research prompt with full context
   */
  private buildResearchPrompt(
    task: EnhancedTask,
    dependencyContext: Record<string, any>,
    projectContext: Record<string, any>
  ): string {
    
    const { prd, architecture, specifications, fileStructure } = this.context!;
    
    return `You are an expert project manager and senior software engineer. Your task is to perform comprehensive research for the following development task with full awareness of project context and dependencies.

**Task Details:**
- **Title**: ${task.title}
- **Category**: ${task.category}
- **Description**: ${task.description || 'No description provided'}
- **Priority**: ${task.priority}
- **Estimated Duration**: ${task.estimatedDuration || 'Not estimated'} hours

**Project Context:**
- **PRD**: ${prd}
- **Architecture**: ${architecture}
- **Specifications**: ${specifications}
- **File Structure**: ${fileStructure}

**Dependency Context:**
${dependencyContext.completedTasks ? `
- **Completed Dependencies**: ${dependencyContext.completedTasks.length} tasks completed
${dependencyContext.completedTasks.map((t: any) => `  - ${t.title} (ID: ${t.id})`).join('\n')}
` : '- No completed dependencies'}

${dependencyContext.insights ? `
- **Insights from Dependencies**: ${dependencyContext.insights}
` : ''}

**Project Positioning:**
${projectContext.dependentTasks ? `
- **Dependent Tasks**: This task is a prerequisite for ${projectContext.dependentTasks.length} subsequent tasks
${projectContext.dependentTasks.map((t: any) => `  - ${t.title}`).join('\n')}
` : '- No dependent tasks'}

${projectContext.similarTasks ? `
- **Similar Tasks**: ${projectContext.similarTasks.length} related tasks in same category
${projectContext.similarTasks.map((t: any) => `  - ${t.title}`).join('\n')}
` : ''}

**Project Constraints**: ${projectContext.projectConstraints || 'No specific constraints identified'}

**Research Requirements:**

1. **Architecture Context**: Explain how this task fits into the overall architecture and project goals
2. **Implementation Steps**: Provide detailed, step-by-step implementation guidance that:
   - References specific files from the file structure
   - Considers completed dependencies for integration points
   - Accounts for dependent tasks in the design
   - Follows best practices for the task category
   
3. **Acceptance Criteria**: Define clear, measurable criteria for successful completion

**Quality Requirements:**
- Implementation steps should be comprehensive but not overly detailed
- Consider the relationship between this task and others in the project
- Ensure logical flow from dependencies to dependents
- Reference actual files that should exist based on the file structure

**Output Format:**
Respond with ONLY a valid JSON object conforming to the output schema.

Generate comprehensive research for this task considering all available context.`;
  }

  /**
   * Validate generated research against project constraints
   */
  private async validateResearch(
    researchedTask: EnhancedTask,
    dependencyGraph: DependencyGraph
  ): Promise<void> {
    
    const validationResults = [];
    
    // Check that implementation steps reference valid files
    if (this.context?.fileStructure) {
      const fileReferences = this.extractFileReferences(researchedTask.implementationSteps);
      
      for (const filePath of fileReferences) {
        if (!this.isValidFileReference(filePath, this.context.fileStructure)) {
          validationResults.push({
            type: 'consistency',
            message: `Research references file ${filePath} not found in project structure`,
            severity: 'warning'
          });
        }
      }
    }

    // Check that research aligns with task dependencies
    const missingDependencyContext = researchedTask.dependencies.filter(depId => 
      !dependencyGraph.tasks[depId]
    );

    if (missingDependencyContext.length > 0) {
      validationResults.push({
        type: 'consistency',
        message: `Research references ${missingDependencyContext.length} missing dependencies`,
        severity: 'error'
      });
    }

    // Log validation results
    if (validationResults.length > 0) {
      console.warn(`Validation warnings for task "${researchedTask.title}":`, validationResults);
    }
  }

  /**
   * Extract insights from completed tasks
   */
  private extractInsightsFromCompletedTasks(completedDependencies: string[]): string {
    if (completedDependencies.length === 0) return 'No completed dependencies to reference';
    
    const insights = [
      `Completed ${completedDependencies.length} prerequisite tasks successfully`,
      'Can leverage patterns and approaches from previous work',
      'Integration points established with earlier components'
    ];

    return insights.join('. ');
  }

  /**
   * Extract project-wide constraints from dependency graph
   */
  private extractProjectConstraints(dependencyGraph: DependencyGraph): string {
    const constraints = [];
    
    // Check for complex dependencies
    const taskCount = Object.keys(dependencyGraph.tasks).length;
    
    if (taskCount > 15) {
      constraints.push('Large project with many interdependencies');
    }

    // Check for high-priority critical path
    const criticalTasks = Object.values(dependencyGraph.tasks)
      .filter(task => task.priority === 'critical');
    
    if (criticalTasks.length > 2) {
      constraints.push(`${criticalTasks.length} critical tasks requiring careful sequencing`);
    }

    // Check for testing coverage
    const testTasks = Object.values(dependencyGraph.tasks)
      .filter(task => task.category === 'testing');
    
    if (testTasks.length / taskCount < 0.2) {
      constraints.push('Limited testing coverage in current plan');
    }

    return constraints.join('. ') || 'No major project constraints identified';
  }

  /**
   * Extract file references from text
   */
  private extractFileReferences(text: string): string[] {
    const filePattern = /(?:[a-zA-Z]:\\|\/)?[\w\-./]+?\.(?:ts|tsx|js|jsx|py|java|cpp|c|h|go|rs|php|rb|sql|md|txt|json|yaml|yml|xml|html|css|scss|sass|less|vue|jsx?)/g;
    return text.match(filePattern) || [];
  }

  /**
   * Check if a file reference is valid
   */
  private isValidFileReference(filePath: string, structure: string): boolean {
    return structure.toLowerCase().includes(filePath.toLowerCase());
  }

  /**
   * Group tasks by dependency level for optimized processing
   */
  private groupTasksByDependencyLevel(
    taskIds: string[],
    dependencyGraph: DependencyGraph
  ): Record<string, string[]> {
    
    const levels: Record<string, string[]> = {};
    const taskMap = dependencyGraph.tasks;
    
    // Calculate maximum dependency depth for each task
    const getTaskLevel = (taskId: string, visited = new Set<string>()): number => {
      if (visited.has(taskId)) return 0; // Circular dependency handling
      visited.add(taskId);
      
      const task = taskMap[taskId];
      if (!task || task.dependencies.length === 0) return 1;
      
      const maxDepLevel = Math.max(...task.dependencies.map(depId => 
        getTaskLevel(depId, new Set(visited))
      ));
      
      return maxDepLevel + 1;
    };

    // Group tasks by their level
    taskIds.forEach(taskId => {
      const level = getTaskLevel(taskId);
      
      if (!levels[level.toString()]) {
        levels[level.toString()] = [];
      }
      
      levels[level.toString()].push(taskId);
    });

    return levels;
  }

  /**
   * Generate fallback research when AI generation fails
   */
  private async generateFallbackResearch(
    taskId: string,
    context: UnifiedProjectContext,
    dependencyGraph: DependencyGraph
  ): Promise<EnhancedTask> {
    
    const task = dependencyGraph.tasks[taskId];
    if (!task) {
      throw new Error(`Task ${taskId} not found in dependency graph`);
    }

    const fallbackImplementation = `This task requires detailed research to be completed successfully. 

**Context:**
${task.context}

**Implementation Guidelines:**
- Review the project architecture and specifications for requirements
- Check file structure to understand implementation patterns  
- Consider dependencies that must be completed first
- Define clear acceptance criteria before starting work

**Next Steps:**
1. Review task context and dependencies
2. Examine related files in the project structure  
3. Consult with team if requirements are unclear
4. Break down into smaller subtasks as needed`;

    const fallbackAcceptance = `Task completion requires:
- All specified functionality implemented correctly
- Code follows project architecture and patterns  
- Integration with dependencies working properly
- Acceptance criteria clearly met`;

    return {
      ...task,
      implementationSteps: fallbackImplementation,
      acceptanceCriteria: fallbackAcceptance
    };
  }

}

// Export singleton instance  
export const taskResearchEngine = new TaskResearchEngine();

