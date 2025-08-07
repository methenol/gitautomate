

/**
 * Unified Project Context Types
 * 
 * These types define the new unified architecture that replaces the sequential silo system.
 * All components share a single, evolving context object with dependency management.
 */

import { z } from 'genkit';
import type { Task } from '@/types';

// Dependency graph edge definition
const DependencyEdgeSchema = z.object({
  source: z.string().describe('Source task title'),
  target: z.string().describe('Target task title that depends on source'),
  type: z.enum(['prerequisite', 'sequential']).describe('Type of dependency')
});

export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;

// Validation result for cross-consistency checking
const ValidationResultSchema = z.object({
  isValid: z.boolean().describe('Whether the validation passed'),
  errors: z.array(z.string()).describe('List of validation errors'),
  warnings: z.array(z.string()).describe('List of validation warnings'),
  timestamp: z.string().describe('When the validation was performed')
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// Complete unified project context
const UnifiedProjectContextSchema = z.object({
  prd: z.string().describe('The original Product Requirements Document'),
  architecture: z.string().describe('Generated project architecture (user-editable)'),
  specifications: z.string().describe('Generated project specifications (user-editable)'),
  fileStructure: z.string().describe('Generated file structure (user-editable)'),
  
  // Dependency modeling
  tasks: z.array(z.string()).describe('Task titles in dependency order'),
  dependencyGraph: z.array(DependencyEdgeSchema).describe('Explicit dependencies between tasks'),
  
  // Validation and state tracking
  validationHistory: z.array(ValidationResultSchema).describe('Historical validation results'),
  lastUpdated: z.string().describe('Timestamp of last context update')
});

export type UnifiedProjectContext = z.infer<typeof UnifiedProjectContextSchema>;

// Research context with dependency awareness
const TaskResearchContextSchema = z.object({
  taskTitle: z.string().describe('The current task being researched'),
  completedTasks: z.array(z.string()).describe('Titles of already completed tasks'),
  pendingTasks: z.array(z.string()).describe('Titles of remaining tasks to be researched'),
  contextInsights: z.record(z.string(), z.string()).describe('Accumulated insights from previous task research')
});

export type TaskResearchContext = z.infer<typeof TaskResearchContextSchema>;

// Complete project plan output
const ProjectPlanOutputSchema = z.object({
  tasks: z.array(z.record(Task.schema)).describe('Tasks with full implementation details'),
  executionOrder: z.array(z.string()).describe('Sequential task execution order based on dependencies'),
  validationResults: z.array(ValidationResultSchema).describe('Cross-consistency validation results'),
  estimatedDuration: z.number().optional().describe('Estimated implementation duration in hours')
});

export type ProjectPlanOutput = z.infer<typeof ProjectPlanOutputSchema>;
