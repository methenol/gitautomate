'use server';

/**
 * @fileOverview Comprehensive validation pipeline for unified project context
 */

import { UnifiedProjectContext, ValidationResult } from '@/types/unified-context';

export class ContextValidator {
  
  static validateFullContext(context: UnifiedProjectContext): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Architecture validation
    results.push(...this.validateArchitecture(context));
    
    // File structure validation  
    results.push(...this.validateFileStructure(context));
    
    // Task validation
    results.push(...this.validateTasks(context));
    
    // Dependency validation
    results.push(...this.validateDependencies(context));
    
    // Cross-component consistency validation
    results.push(...this.validateCrossConsistency(context));
    
    return results;
  }

  private static validateArchitecture(context: UnifiedProjectContext): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    if (!context.architecture) {
      results.push({
        isValid: false,
        issues: ['Architecture is missing'],
        component: 'architecture',
        severity: 'error'
      });
      return results;
    }

    // Check for essential architecture components
    const arch = context.architecture.toLowerCase();
    const requiredPatterns = [
      { pattern: 'component', message: 'No component architecture mentioned' },
      { pattern: 'data', message: 'No data flow or storage architecture mentioned' },
      { pattern: 'api|endpoint|service', message: 'No API or service architecture mentioned' }
    ];

    requiredPatterns.forEach(({ pattern, message }) => {
      if (!new RegExp(pattern).test(arch)) {
        results.push({
          isValid: false,
          issues: [message],
          component: 'architecture',
          severity: 'warning'
        });
      }
    });

    return results;
  }

  private static validateFileStructure(context: UnifiedProjectContext): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    if (!context.fileStructure) {
      results.push({
        isValid: false,
        issues: ['File structure is missing'],
        component: 'fileStructure',
        severity: 'error'
      });
      return results;
    }

    // Check for logical file organization
    const structure = context.fileStructure.toLowerCase();
    
    // Validate common project patterns
    if (context.architecture.toLowerCase().includes('react') && !structure.includes('components')) {
      results.push({
        isValid: false,
        issues: ['React architecture specified but no components directory in file structure'],
        component: 'fileStructure',
        severity: 'error'
      });
    }

    if (context.architecture.toLowerCase().includes('api') && !structure.includes('api') && !structure.includes('routes')) {
      results.push({
        isValid: false,
        issues: ['API architecture specified but no API routes in file structure'],
        component: 'fileStructure',
        severity: 'warning'
      });
    }

    return results;
  }

  private static validateTasks(context: UnifiedProjectContext): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    if (!context.tasks || context.tasks.length === 0) {
      results.push({
        isValid: false,
        issues: ['No tasks generated'],
        component: 'tasks',
        severity: 'error'
      });
      return results;
    }

    // Validate task ordering and dependencies
    const setupTasks = context.tasks.filter(t => 
      t.title.toLowerCase().includes('setup') || 
      t.title.toLowerCase().includes('configure') ||
      t.title.toLowerCase().includes('initialize')
    );

    if (setupTasks.length === 0) {
      results.push({
        isValid: false,
        issues: ['No setup or configuration tasks found'],
        component: 'tasks',
        severity: 'warning'
      });
    }

    // Check for missing essential tasks
    const taskTitles = context.tasks.map(t => t.title.toLowerCase()).join(' ');
    
    if (context.architecture.toLowerCase().includes('test') && !taskTitles.includes('test')) {
      results.push({
        isValid: false,
        issues: ['Testing mentioned in architecture but no testing tasks generated'],
        component: 'tasks',
        severity: 'warning'
      });
    }

    // Validate task references to file structure
    context.tasks.forEach(task => {
      const taskDetails = task.details.toLowerCase();
      if (taskDetails.includes('create') || taskDetails.includes('modify')) {
        // Check if mentioned files exist in structure
        const fileRefs = this.extractFileReferences(task.details);
        fileRefs.forEach(fileRef => {
          if (!context.fileStructure.toLowerCase().includes(fileRef.toLowerCase())) {
            results.push({
              isValid: false,
              issues: [`Task "${task.title}" references file "${fileRef}" not found in file structure`],
              component: 'tasks',
              severity: 'warning'
            });
          }
        });
      }
    });

    return results;
  }

  private static validateDependencies(context: UnifiedProjectContext): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Check for circular dependencies
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const checkCircular = (taskId: string): boolean => {
      if (visiting.has(taskId)) {
        results.push({
          isValid: false,
          issues: [`Circular dependency detected involving task: ${taskId}`],
          component: 'dependencies',
          severity: 'error'
        });
        return true;
      }
      
      if (visited.has(taskId)) return false;
      
      visiting.add(taskId);
      const task = context.tasks.find(t => t.id === taskId);
      
      if (task) {
        task.dependencies.forEach(depId => {
          checkCircular(depId);
        });
      }
      
      visiting.delete(taskId);
      visited.add(taskId);
      return false;
    };

    context.tasks.forEach(task => {
      if (!visited.has(task.id)) {
        checkCircular(task.id);
      }
    });

    // Validate dependency references
    const taskIds = new Set(context.tasks.map(t => t.id));
    context.tasks.forEach(task => {
      task.dependencies.forEach(depId => {
        if (!taskIds.has(depId)) {
          results.push({
            isValid: false,
            issues: [`Task "${task.title}" has invalid dependency reference: ${depId}`],
            component: 'dependencies',
            severity: 'error'
          });
        }
      });
    });

    return results;
  }

  private static validateCrossConsistency(context: UnifiedProjectContext): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Architecture-PRD consistency
    if (context.prd && context.architecture) {
      const prdFeatures = this.extractFeatures(context.prd);
      const archComponents = this.extractComponents(context.architecture);
      
      prdFeatures.forEach(feature => {
        if (!archComponents.some(comp => comp.includes(feature) || feature.includes(comp))) {
          results.push({
            isValid: false,
            issues: [`PRD feature "${feature}" not addressed in architecture`],
            component: 'architecture',
            severity: 'warning'
          });
        }
      });
    }

    // Task-PRD coverage
    if (context.prd && context.tasks.length > 0) {
      const prdRequirements = this.extractRequirements(context.prd);
      const taskCoverage = context.tasks.map(t => t.title + ' ' + t.details).join(' ').toLowerCase();
      
      prdRequirements.forEach(req => {
        if (!taskCoverage.includes(req.toLowerCase())) {
          results.push({
            isValid: false,
            issues: [`PRD requirement "${req}" not covered by any task`],
            component: 'tasks',
            severity: 'warning'
          });
        }
      });
    }

    return results;
  }

  private static extractFileReferences(text: string): string[] {
    // Extract file references from task details
    const filePatterns = [
      /create\s+(\w+\.\w+)/gi,
      /modify\s+(\w+\.\w+)/gi,
      /(\w+\/\w+\.\w+)/gi,
      /(\w+\.\w+)/gi
    ];
    
    const files: string[] = [];
    filePatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) files.push(match[1]);
      }
    });
    
    return [...new Set(files)]; // Remove duplicates
  }

  private static extractFeatures(prd: string): string[] {
    // Simple feature extraction from PRD
    const patterns = [
      /as a .+, i want to (.+?)(?:\.|,|so that)/gi,
      /feature[:\s]+(.+?)(?:\.|,|\n)/gi,
      /implement (.+?)(?:\.|,|\n)/gi
    ];
    
    const features: string[] = [];
    patterns.forEach(pattern => {
      const matches = prd.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) features.push(match[1].trim());
      }
    });
    
    return features;
  }

  private static extractComponents(architecture: string): string[] {
    // Extract component mentions from architecture
    const patterns = [
      /component[:\s]+(.+?)(?:\.|,|\n)/gi,
      /module[:\s]+(.+?)(?:\.|,|\n)/gi,
      /service[:\s]+(.+?)(?:\.|,|\n)/gi,
      /(\w+)\s+component/gi
    ];
    
    const components: string[] = [];
    patterns.forEach(pattern => {
      const matches = architecture.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) components.push(match[1].trim());
      }
    });
    
    return components;
  }

  private static extractRequirements(prd: string): string[] {
    // Extract requirements from PRD
    const patterns = [
      /requirement[:\s]+(.+?)(?:\.|,|\n)/gi,
      /must (.+?)(?:\.|,|\n)/gi,
      /should (.+?)(?:\.|,|\n)/gi,
      /user can (.+?)(?:\.|,|\n)/gi
    ];
    
    const requirements: string[] = [];
    patterns.forEach(pattern => {
      const matches = prd.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) requirements.push(match[1].trim());
      }
    });
    
    return requirements;
  }
}