'use server';

/**
 * @fileOverview Enhanced task research engine with full context awareness and dependency propagation
 */

import { ai } from '@/ai/litellm';
import { z } from 'zod';
import { UnifiedProjectContext } from '@/types/unified-context';

const EnhancedResearchOutputSchema = z.object({
  context: z.string().describe('How this task fits into the overall architecture and dependencies'),
  implementationSteps: z.string().describe('Detailed implementation steps considering completed tasks'),
  acceptanceCriteria: z.string().describe('Clear acceptance criteria'),
  discoveredDependencies: z.array(z.string()).describe('Additional dependencies discovered during research'),
  riskFactors: z.array(z.string()).describe('Potential risks or blockers'),
  integrationPoints: z.array(z.string()).describe('Integration points with other components'),
  testingStrategy: z.string().describe('Testing approach for this task'),
  estimatedComplexity: z.enum(['low', 'medium', 'high']).describe('Complexity assessment'),
});

export type EnhancedResearchOutput = z.infer<typeof EnhancedResearchOutputSchema>;

export class EnhancedTaskResearchEngine {
  
  async researchWithFullContext(
    task: UnifiedProjectContext['tasks'][0],
    context: UnifiedProjectContext,
    completedTasks: string[],
    apiKey?: string,
    model?: string
  ): Promise<EnhancedResearchOutput> {
    
    // Build comprehensive context including completed tasks
    const completedTaskDetails = context.tasks
      .filter(t => completedTasks.includes(t.id))
      .map(t => `${t.title}: ${t.details}`)
      .join('\n\n');
    
    const dependentTasks = context.tasks
      .filter(t => task.dependencies.includes(t.id))
      .map(t => `${t.id}: ${t.title}`)
      .join('\n');
    
    const blockedTasks = context.tasks
      .filter(t => t.dependencies.includes(task.id))
      .map(t => `${t.id}: ${t.title}`)
      .join('\n');

    const prompt = `You are an expert project manager and senior software engineer conducting detailed research for a development task. You have access to the complete project context including previously completed tasks and dependency relationships.

CRITICAL: Your research must account for:
1. Work already completed in previous tasks
2. Dependencies that must be satisfied
3. How this task affects downstream tasks
4. Integration points with existing architecture
5. Realistic implementation considering the current project state

PROJECT CONTEXT:
================
PRD: ${context.prd}

ARCHITECTURE:
${context.architecture}

FILE STRUCTURE:
${context.fileStructure}

SPECIFICATIONS:
${context.specifications}

TASK TO RESEARCH:
================
Task ID: ${task.id}
Title: ${task.title}
Order: ${task.order}
Status: ${task.status}

DEPENDENCY CONTEXT:
==================
Prerequisites (must be completed first):
${dependentTasks || 'None'}

Tasks that depend on this one:
${blockedTasks || 'None'}

COMPLETED TASKS (available for reference):
========================================
${completedTaskDetails || 'None completed yet'}

RESEARCH REQUIREMENTS:
=====================
Provide comprehensive research that includes:

1. CONTEXT: Explain exactly how this task fits into the overall architecture, considering what has already been implemented and what comes next.

2. IMPLEMENTATION STEPS: Provide detailed, sequential implementation steps that:
   - Build upon work completed in previous tasks
   - Consider the current state of the project
   - Prepare the foundation for dependent tasks
   - Include specific file modifications/creations
   - Account for integration points

3. ACCEPTANCE CRITERIA: Define clear, testable criteria for completion that align with the overall project goals.

4. DISCOVERED DEPENDENCIES: Identify any additional dependencies or prerequisites not captured in the initial task planning.

5. RISK FACTORS: Identify potential risks, blockers, or complications that could arise during implementation.

6. INTEGRATION POINTS: Specify how this task integrates with other system components and previously completed work.

7. TESTING STRATEGY: Outline the testing approach appropriate for this task.

8. ESTIMATED COMPLEXITY: Assess the complexity level considering the current project state.

Generate your research results as a JSON object conforming to the output schema.`;

    const modelName = model || 'gpt-4o';
    
    const { output } = await ai.generate({
      model: modelName,
      prompt: prompt,
      output: { schema: EnhancedResearchOutputSchema },
      config: apiKey ? { apiKey } : undefined,
    });

    if (!output) {
      throw new Error('Failed to generate enhanced research results');
    }

    return output as typeof EnhancedResearchOutputSchema._type;
  }

  async validateTaskConsistency(
    task: UnifiedProjectContext['tasks'][0],
    context: UnifiedProjectContext,
    researchResult: EnhancedResearchOutput
  ): Promise<string[]> {
    const issues: string[] = [];
    
    // Check if discovered dependencies are valid
    researchResult.discoveredDependencies.forEach(dep => {
      const exists = context.tasks.some(t => t.id === dep || t.title.toLowerCase().includes(dep.toLowerCase()));
      if (!exists) {
        issues.push(`Discovered dependency "${dep}" does not correspond to any existing task`);
      }
    });
    
    // Check for file references that don't exist in structure
    const fileRefs = this.extractFileReferences(researchResult.implementationSteps);
    fileRefs.forEach(fileRef => {
      if (!context.fileStructure.toLowerCase().includes(fileRef.toLowerCase())) {
        issues.push(`Implementation references file "${fileRef}" not found in file structure`);
      }
    });
    
    // Check for architecture alignment
    const implementationLower = researchResult.implementationSteps.toLowerCase();
    const architectureLower = context.architecture.toLowerCase();
    
    if (implementationLower.includes('component') && !architectureLower.includes('component')) {
      issues.push('Implementation mentions components but architecture does not specify component patterns');
    }
    
    return issues;
  }

  private extractFileReferences(text: string): string[] {
    const patterns = [
      /(?:create|modify|update)\s+(?:file\s+)?([\w/]+\/)?(\w+\.\w+)/gi,
      /(\w+[\w/]*\.\w+)/gi,
      /(\w+\.\w+)/gi
    ];
    
    const files: string[] = [];
    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].includes('.')) {
          files.push(match[1]);
        }
      }
    });
    
    return [...new Set(files)];
  }
}