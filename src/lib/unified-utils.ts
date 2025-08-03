import { UnifiedProjectManager } from '@/lib/unified-project-manager';
import { UnifiedProjectContext, EnhancedTask } from '@/types/unified-context';

const projectManager = new UnifiedProjectManager();

// Utility functions for working with the unified context
export function updateProjectContext(
  context: UnifiedProjectContext,
  updates: Partial<UnifiedProjectContext>
): UnifiedProjectContext {
  return projectManager.updateContext(context, updates);
}

export function convertLegacyTasksToEnhanced(tasks: any[]): EnhancedTask[] {
  return tasks.map(task => ({
    title: task.title,
    details: task.details || '',
    dependencies: {
      taskTitle: task.title,
      dependsOn: [],
      blockedBy: [],
      priority: 3,
      category: 'core' as const,
    },
    researched: Boolean(task.details && task.details.trim() && task.details !== 'Researching...'),
  }));
}

export function convertEnhancedTasksToLegacy(enhancedTasks: EnhancedTask[]): any[] {
  return enhancedTasks.map(task => ({
    title: task.title,
    details: task.details,
  }));
}