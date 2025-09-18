


'use server';

/**
 * @fileOverview GitAutomate adapter that replaces legacy AI flows with spec-kit enhanced versions
 *
 * This module provides backward compatibility by maintaining the existing function signatures 
 * while internally using spec-kit integration for enhanced quality and structure.
 */

import { generateArchitecture } from '@/ai/flows/generate-architecture';
import { generateTasks } from '@/ai/flows/generate-tasks'; 
import { researchTask } from '@/ai/flows/research-task';
import { specKitIntegration, SpecKitArchitectureInput, SpecKitTasksInput, SpecKitTaskDetailsInput } from './spec-kit-integration';
import { GenerateArchitectureOutput, GenerateTasksOutput, ResearchTaskInput } from '@/ai/flows/generate-architecture';
import { TaskSchema } from '@/types';

// Legacy input/output types for backward compatibility
type GenerateArchitectureLegacyInput = {
  prd: string;
};

type GenerateTasksLegacyInput = {
  architecture: string;
  specifications: string; 
  fileStructure?: string;
};

type ResearchTaskLegacyInput = {
  title: string;
  architecture: string;
  fileStructure?: string;
  specifications: string;
};

/**
 * Enhanced Architecture Generator with Spec-Kit Integration
 * Replaces legacy generateArchitecture() function
 */
export async function generateArchitectureEnhanced(
  input: GenerateArchitectureLegacyInput,
  apiKey?: string,
  model?: string, 
  apiBase?: string,
  temperature?: number
): Promise<GenerateArchitectureOutput> {
  
  console.log('🚀 Generating architecture with spec-kit integration...');
  
  try {
    // Use spec-kit enhanced generation
    const result = await specKitIntegration.generateArchitectureWithSpecKit(
      {
        prd: input.prd
      },
      apiKey,
      model,
      temperature || 0.7
    );

    // Return in legacy format for compatibility
    return {
      architecture: result.architecture,
      specifications: result.specifications
    };

  } catch (specKitError) {
    console.warn('Spec-kit integration failed, falling back to legacy generation:', specKitError);
    
    // Fallback to original implementation if spec-kit fails
    return generateArchitecture(input, apiKey, model, apiBase, temperature);
  }
}

/**
 * Enhanced Task Generator with Spec-Kit Integration  
 * Replaces legacy generateTasks() function
 */
export async function generateTasksEnhanced(
  input: GenerateTasksLegacyInput,
  apiKey?: string,
  model?: string,
  apiBase?: string, 
  useTDD?: boolean,
  temperature?: number
): Promise<GenerateTasksOutput> {
  
  console.log('🚀 Generating tasks with spec-kit integration...');
  
  try {
    // Use spec-kit enhanced generation
    const result = await specKitIntegration.generateTasksWithSpecKit(
      {
        architecture: input.architecture,
        specifications: input.specifications,
        fileStructure: input.fileStructure
      },
      apiKey,
      model,
      temperature || 0.7
    );

    // Convert to legacy format for compatibility
    const tasks = result.tasks.map(task => ({
      title: task.title,
      details: '', // Will be populated in research phase
    }));

    return { tasks };

  } catch (specKitError) {
    console.warn('Spec-kit integration failed, falling back to legacy generation:', specKitError);
    
    // Fallback to original implementation
    return generateTasks(input, apiKey, model, apiBase, useTDD, temperature);
  }
}

/**
 * Enhanced Task Research with Spec-Kit Integration
 * Replaces legacy researchTask() function 
 */
export async function researchTaskEnhanced(
  input: ResearchTaskLegacyInput,
  apiKey?: string, 
  model?: string,
  apiBase?: string,
  useTDD?: boolean,
  temperature?: number
) {
  
  console.log('🚀 Generating task details with spec-kit integration...');
  
  try {
    // Use spec-kit enhanced generation
    const result = await specKitIntegration.generateTaskDetailsWithSpecKit(
      {
        title: input.title,
        architecture: input.architecture,
        specifications: input.specifications,
        fileStructure: input.fileStructure
      },
      apiKey, 
      model,
      temperature || 0.7
    );

    return {
      markdownContent: result.markdownContent
    };

  } catch (specKitError) {
    console.warn('Spec-kit integration failed, falling back to legacy generation:', specKitError);
    
    // Fallback to original implementation
    return researchTask(input, apiKey, model, apiBase, useTDD, temperature);
  }
}

/**
 * Unified orchestrator that uses spec-kit integration with fallback
 */
export class EnhancedProjectOrchestrator {
  
  /**
   * Generate unified plan with spec-kit integration
   */
  async generateUnifiedPlanEnhanced(
    input: {
      prd?: string;
      architecture?: string;
      specifications?: string; 
      fileStructure?: string;
    },
    apiKey?: string,
    model?: string
  ) {
    
    console.log('🚀 Enhanced orchestrator with spec-kit integration...');
    
    try {
      // Step 1: Generate architecture if needed using enhanced version
      let architecture = input.architecture;
      let specifications = input.specifications;
      
      if (!architecture && input.prd) {
        const archResult = await generateArchitectureEnhanced(
          { prd: input.prd },
          apiKey,
          model
        );
        
        architecture = archResult.architecture;
        specifications = archResult.specifications || '';
      }

      if (!architecture) {
        throw new Error('Architecture is required or could not be generated');
      }

      // Step 2: Generate tasks using enhanced version
      const fileStructure = input.fileStructure || '';
      
      if (!specifications) {
        // Use architecture as fallback for specifications
        specifications = '';
      }

      const tasksResult = await generateTasksEnhanced(
        {
          architecture,
          specifications, 
          fileStructure
        },
        apiKey,
        model
      );

      // Step 3: Generate task details for each task using enhanced version  
      const tasksWithDetails = [];
      
      for (let i = 0; i < tasksResult.tasks.length; i++) {
        const task = tasksResult.tasks[i];
        
        try {
          const detailsResult = await researchTaskEnhanced(
            {
              title: task.title,
              architecture,
              specifications, 
              fileStructure
            },
            apiKey,
            model
          );

          tasksWithDetails.push({
            ...task,
            details: detailsResult.markdownContent
          });

        } catch (detailError) {
          console.warn(`Failed to generate details for task ${task.title}:`, detailError);
          
          // Use original title without details
          tasksWithDetails.push({
            ...task,
            details: `Task: ${task.title}\n\n[Research not available]`
          });
        }
      }

      return {
        architecture,
        specifications: specifications || '',
        tasks: tasksWithDetails.map((task, index) => ({
          ...task,
          id: `task-${index + 1}`,
          order: index + 1,
          dependencies: this.inferTaskDependencies(task.title, tasksWithDetails),
          status: 'pending' as const,
        })),
        validationResults: {
          specKitIntegrationSuccess: true,
          qualityMetrics: this.calculateQualityScores(tasksWithDetails)
        }
      };

    } catch (error) {
      console.error('Enhanced orchestrator failed, falling back to legacy:', error);
      
      // Fallback to original orchestrator logic
      return this.generateUnifiedPlanLegacy(input, apiKey, model);
    }
  }

  /**
   * Legacy fallback implementation
   */
  private async generateUnifiedPlanLegacy(
    input: {
      prd?: string;
      architecture?: string;
      specifications?: string;
      fileStructure?: string; 
    },
    apiKey?: string,
    model?: string
  ) {
    
    // This would contain the original orchestrator logic as fallback
    // For now, throw error to indicate legacy path not implemented yet
    
    throw new Error('Legacy orchestrator fallback not fully implemented');
  }

  /**
   * Infer task dependencies based on spec-kit patterns
   */
  private inferTaskDependencies(taskTitle: string, allTasks: any[]): string[] {
    const dependencies: string[] = [];
    
    // Basic dependency inference logic enhanced for spec-kit patterns
    const lowerTitle = taskTitle.toLowerCase();
    
    // Setup tasks come first (no dependencies)
    if (lowerTitle.includes('setup') || lowerTitle.includes('configure')) {
      return [];
    }
    
    // Test tasks depend on setup
    if (lowerTitle.includes('test') && !lowerTitle.includes('setup')) {
      const setupTasks = allTasks.filter((t) => 
        t.title.toLowerCase().includes('setup') || 
        t.title.toLowerCase().includes('config')
      );
      
      if (setupTasks.length > 0) {
        dependencies.push(setupTasks[setupTasks.length - 1].id);
      }
    }

    // Implementation tasks depend on tests and setup
    if (lowerTitle.includes('implement') || lowerTitle.includes('model')) {
      const testTasks = allTasks.filter((t) => 
        t.title.toLowerCase().includes('test') && !t.title.includes('setup')
      );
      
      if (testTasks.length > 0) {
        dependencies.push(testTasks[testTasks.length - 1].id);
      }
    }

    return dependencies;
  }

  /**
   * Calculate quality scores for generated tasks
   */
  private calculateQualityScores(tasks: any[]): {
    tddCompliance: number;
    parallelExecution: number;
    completeness: number;
  } {
    
    const testTasks = tasks.filter(t => t.title.toLowerCase().includes('test'));
    const implementationTasks = tasks.filter(t => 
      t.title.toLowerCase().includes('implement') || 
      t.title.toLowerCase().includes('model')
    );

    // TDD compliance: tests should come before implementation
    const testFirstCompliance = this.checkTestOrder(tasks);
    
    // Parallel execution potential  
    const parallelTasks = tasks.filter(t => 
      t.title.toLowerCase().includes('[p]') || 
      this.canRunInParallel(t, tasks)
    );

    return {
      tddCompliance: testFirstCompliance ? 100 : Math.min((testTasks.length / tasks.length) * 100, 80),
      parallelExecution: Math.min((parallelTasks.length / tasks.length) * 100, 90),
      completeness: Math.min(tasks.length * 10, 100) // More tasks = more complete
    };
  }

  /**
   * Check if tests come before implementation (TDD order)
   */
  private checkTestOrder(tasks: any[]): boolean {
    const testIndices = tasks
      .filter(t => t.title.toLowerCase().includes('test'))
      .map((t, i) => tasks.findIndex(task => task.title === t.title));
    
    const implementationIndices = tasks
      .filter(t => 
        t.title.toLowerCase().includes('implement') || 
        t.title.toLowerCase().includes('model')
      )
      .map((t, i) => tasks.findIndex(task => task.title === t.title));

    if (testIndices.length === 0 || implementationIndices.length === 0) {
      return true; // No tests or no implementations to order
    }

    const maxTestIndex = Math.max(...testIndices);
    const minImplementationIndex = Math.min(...implementationIndices);

    return maxTestIndex < minImplementationIndex;
  }

  /**
   * Check if a task can run in parallel with others
   */
  private canRunInParallel(task: any, allTasks: any[]): boolean {
    // Simple heuristic: tasks mentioning different files can often run in parallel
    const taskFiles = this.extractFilePatterns(task.title);
    
    // Check for file conflicts with other tasks
    const conflictingTasks = allTasks.filter(otherTask => {
      if (otherTask.title === task.title) return false;
      
      const otherFiles = this.extractFilePatterns(otherTask.title);
      return taskFiles.some(file => 
        otherFiles.some(otherFile => file === otherFile)
      );
    });

    // Can run in parallel if no significant file conflicts
    return conflictingTasks.length <= 1;
  }

  /**
   * Extract file patterns from task title
   */
  private extractFilePatterns(title: string): string[] {
    const patterns = [];
    
    if (title.includes('src/')) {
      const srcMatch = title.match(/src\/[^\s\)]+/g);
      if (srcMatch) patterns.push(...srcMatch);
    }
    
    if (title.includes('tests/')) {
      const testMatch = title.match(/tests\/[^\s\)]+/g);
      if (testMatch) patterns.push(...testMatch);
    }

    return patterns;
  }
}

// Export enhanced orchestrator
export const enhancedProjectOrchestrator = new EnhancedProjectOrchestrator();

