

'use server';

/**
 * @fileOverview Unified Project Context - Centralized state management for the unified orchestrator
 */

import { z } from 'genkit';

// Import context manager class
import {
  ProjectContextManager,
  getGlobalContextManager,
} from './context-manager-class';

// Define schemas for context management
export const UnifiedProjectContextSchema = z.object({
  prd: z.string(),
  architecture: z.string(),
  specifications: z.string(), 
  fileStructure: z.string(),
  tasks: z.array(z.object({
    title: z.string(),
    details: z.string(),
    dependencies: z.array(z.string()),
    status: z.enum(['pending', 'in_progress', 'completed']),
    researchContext: z.string()
  })),
  validationHistory: z.array(z.object({
    timestamp: z.string(),
    type: z.enum(['context_update', 'architecture_consistency', 'task_dependency_validation', 'file_structure_alignment']),
    status: z.enum(['passed', 'failed', 'warning']),
    message: z.string()
  }))
});

export type UnifiedProjectContext = z.infer<typeof UnifiedProjectContextSchema>;

// Export utility functions for context management
export async function updatePrd(prd: string): Promise<void> {
  const manager = getGlobalContextManager();
  manager.updatePrd(prd);
}

export async function updateArchitecture(architecture: string, specifications: string): Promise<void> {
  const manager = getGlobalContextManager();
  manager.updateArchitecture(architecture, specifications);
}

export async function updateFileStructure(fileStructure: string): Promise<void> {
  const manager = getGlobalContextManager();
  manager.updateFileStructure(fileStructure);
}

export async function addTask(taskTitle: string, details?: string): Promise<void> {
  const manager = getGlobalContextManager();
  manager.addTask(taskTitle, details);
}

export async function getContext(): Promise<UnifiedProjectContext> {
  const manager = getGlobalContextManager();
  return manager.getContext();
}

// Note: ProjectContextManager is exported from context-manager-class.ts but cannot be imported directly in "use server" files

