


'use server';

/**
 * @fileOverview Project plan validator that ensures consistency across architecture, file structure, and tasks.
 *
 * - ProjectPlanValidator - Validates complete project plans for consistency
 */

import { z } from 'genkit';
import { Task, ProjectPlan, ValidationResult } from './unified-context';

const ValidateProjectPlanInputSchema = z.object({
  prd: z.string().describe('The Product Requirements Document (PRD).'),
  architecture: z.string().describe('The proposed software architecture.'),
  specifications: z.string().describe('The detailed specifications.'),
  fileStructure: z.string().describe('The proposed file/folder structure.'),
  tasks: z.array(z.object({
    title: z.string(),
    details: z.string().optional(),
  })).describe('The generated tasks.'),
});

export type ValidateProjectPlanInput = z.infer<typeof ValidateProjectPlanInputSchema>;

const ValidationLevelSchema = z.enum(['basic', 'detailed', 'comprehensive']);
export type ValidationLevel = z.infer<typeof ValidationLevelSchema>;

/**
 * Extracts file references from text (task details, architecture specs, etc.)
 */
function extractFileReferences(text: string): Set<string> {
  const filePattern = /[-\w/.]+\.tsx|[-\w/.]+\.ts|[-\w/.]+\.jsx|[-\w/.]+\.js|[-\w/.]+\.json/g;
  const matches = text.match(filePattern) || [];
  
  // Normalize file paths (remove duplicates that differ only by path separators)
  const normalizedFiles = new Set<string>();
  matches.forEach(file => {
    // Convert to relative paths for comparison
    const normalized = file.replace(/\\/g, '/').replace(/^\.\//, '');
    normalizedFiles.add(normalized);
  });
  
  return normalizedFiles;
}

/**
 * Extracts technology stack mentions from text
 */
function extractTechnologies(text: string): Set<string> {
  const techPatterns = [
    /react/gi,
    /next\.?js/gi, 
    /node\.?js|express/gi,
    /typescript\/ts/gi,
    /python\/(flask|django|fastapi)/gi,
    /java\/spring/gi,
    /c#\/\.net/gi,
    /(vue|angular)/gi,
    /(graphql|rest)/gi,
    /mongodb|mysql|postgres|redis/gi,
  ];
  
  const technologies = new Set<string>();
  techPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      technologies.add(matches[0].toLowerCase());
    }
  });
  
  return technologies;
}

/**
 * Validates consistency between architecture and file structure
 */
export function validateArchitectureFileStructureConsistency(
  architecture: string,
  fileStructure: string
): ValidationResult {
  
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract mentioned components from architecture
  const archComponents = new Set<string>();
  
  // Look for common architectural patterns in the architecture text
  const componentPattern = /component(s?)/gi;
  if (architecture.match(componentPattern)) {
    archComponents.add('components');
    
    // Check if file structure has component directories
    const hasComponentDir = /[/\\]components|component(s?)[/\\]/i.test(fileStructure);
    if (!hasComponentDir) {
      warnings.push('Architecture mentions components but file structure may be missing component directories');
    }
  }

  // Check for API/service layers
  const apiPattern = /api|service(s?)/gi;
  if (architecture.match(apiPattern)) {
    archComponents.add('api/services');
    
    const hasApiDir = /[/\\]api|service(s?)[/\\]/i.test(fileStructure);
    if (!hasApiDir) {
      warnings.push('Architecture mentions APIs/services but file structure may be missing API/service directories');
    }
  }

  // Check for database/data layers
  const dbPattern = /database|data|storage/gi;
  if (architecture.match(dbPattern)) {
    archComponents.add('database/data');
    
    const hasDbDir = /[/\\]db|data|storage/i.test(fileStructure);
    if (!hasDbDir) {
      warnings.push('Architecture mentions database/data but file structure may be missing data directories');
    }
  }

  // Check for test infrastructure
  const testPattern = /test|testing/gi;
  if (architecture.match(testPattern)) {
    const hasTestDir = /[/\\]test|spec(s?)/i.test(fileStructure);
    if (!hasTestDir) {
      warnings.push('Architecture mentions testing but file structure may be missing test directories');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates that tasks align with project requirements
 */
export function validateTaskAlignmentWithRequirements(
  prd: string,
  architecture: string, 
  specifications: string,
  tasks: Task[]
): ValidationResult {
  
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract key requirements from PRD
  const prdKeywords = new Set(
    prd.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !['this', 'that', 'with', 'from', 'they'].includes(word))
  );

  // Extract mentioned features from architecture and specs
  const allFeatures = Array.from(new Set([
    ...architecture.toLowerCase().split(/\s+/),
    ...specifications.toLowerCase().split(/\s+/)
  ])).filter(word => word.length > 4 && !['this', 'that', 'with', 'from'].includes(word));

  // Check if major features are reflected in tasks
  const taskTitles = new Set(tasks.map(task => 
    task.title.toLowerCase().replace(/[^\w\s]/g, ' ')
  ));

  // Compare requirements with task coverage
  const uncoveredRequirements = Array.from(prdKeywords).filter(req => {
    return !Array.from(allFeatures).some(feature => 
      req.includes(String(feature)) || String(feature).includes(req)
    );
  });

  if (uncoveredRequirements.length > 0 && prdKeywords.size > 5) {
    // Only warn if we have significant requirements to check
    const topUncovered = uncoveredRequirements.slice(0, 3);
    warnings.push(`Some key requirements may not have dedicated tasks: ${topUncovered.join(', ')}`);
  }

  // Check for logical task grouping
  const setupTasks = tasks.filter(task => 
    /setup|install|configure/i.test(task.title)
  );

  const coreFeatureTasks = tasks.filter(task => 
    !/setup|install|configure|test|deploy/i.test(task.title)
  );

  if (setupTasks.length === 0 && coreFeatureTasks.length > 3) {
    warnings.push('No setup/installation tasks found. Consider adding project initialization steps.');
  }

  // Check for testing coverage
  const testTasks = tasks.filter(task => 
    /test|spec/i.test(task.title)
  );

  if (tasks.length > 5 && testTasks.length === 0) {
    warnings.push('No testing tasks found for a project of this size. Consider adding test coverage.');
  }

  // Check for deployment/CI-CD
  const deployTasks = tasks.filter(task => 
    /deploy|build|ci|cd/i.test(task.title)
  );

  if (tasks.length > 8 && deployTasks.length === 0) {
    warnings.push('No deployment/CI-CD tasks found. Consider adding deployment configuration.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates file references in tasks against the proposed file structure
 */
export function validateFileReferencesInTasks(
  fileStructure: string,
  tasks: Task[]
): ValidationResult {
  
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fileStructure) {
    return { isValid: true, errors, warnings };
  }

  // Extract all files mentioned in the file structure
  const structureFiles = extractFileReferences(fileStructure);
  
  // Check each task for file references
  tasks.forEach(task => {
    const taskFiles = extractFileReferences(
      (task.details || '') + ' ' + task.title
    );

    // Check if referenced files exist in the structure
    Array.from(taskFiles).forEach(file => {
      const normalizedFile = file.replace(/^\.?\//, '');
      
      if (!structureFiles.has(normalizedFile)) {
        // Check if it's a directory reference
        const isDirRef = !/\.(tsx|ts|jsx|js|json)$/.test(file);
        
        if (!isDirRef) {
          warnings.push(`Task "${task.title}" references file "${file}" that may not exist in the proposed file structure`);
        }
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Performs comprehensive validation of a complete project plan
 */
export async function validateCompleteProjectPlan(
  input: ValidateProjectPlanInput,
  level: ValidationLevel = 'detailed'
): Promise<ValidationResult> {
  
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Basic validation - check all required fields
    if (!input.prd || input.prd.trim().length < 50) {
      errors.push('PRD appears to be too short or empty');
    }

    if (!input.architecture || input.architecture.trim().length < 100) {
      errors.push('Architecture description appears to be too short or empty');
    }

    if (!input.specifications || input.specifications.trim().length < 100) {
      errors.push('Specifications appear to be too short or empty');
    }

    if (!input.fileStructure || input.fileStructure.trim().length < 50) {
      warnings.push('File structure appears to be very short or empty');
    }

    if (!input.tasks || input.tasks.length === 0) {
      errors.push('No tasks were generated');
    } else if (input.tasks.length < 2) {
      warnings.push('Only one task generated - consider breaking down into smaller steps');
    }

    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    // Architecture vs File Structure validation
    if (level !== 'basic') {
      const archFileConsistency = validateArchitectureFileStructureConsistency(
        input.architecture,
        input.fileStructure
      );
      
      errors.push(...archFileConsistency.errors);
      warnings.push(...archFileConsistency.warnings);
    }

    // Task alignment validation
    const taskAlignment = validateTaskAlignmentWithRequirements(
      input.prd,
      input.architecture,
      input.specifications, 
      input.tasks as Task[]
    );

    errors.push(...taskAlignment.errors);
    warnings.push(...taskAlignment.warnings);

    // File reference validation
    if (level === 'comprehensive') {
      const fileRefValidation = validateFileReferencesInTasks(
        input.fileStructure,
        input.tasks as Task[]
      );
      
      warnings.push(...fileRefValidation.warnings);
    }

    // Additional comprehensive checks
    if (level === 'comprehensive') {
      // Technology stack consistency check
      const archTechs = extractTechnologies(input.architecture);
      const specTechs = extractTechnologies(input.specifications);
      
      // Check if architecture and specs mention different technologies
      const techMismatch = new Set([...archTechs].filter(tech => !specTechs.has(tech)));
      if (techMismatch.size > 2) {
        warnings.push('Architecture and specifications mention different technology stacks');
      }

      // Task complexity analysis
      const complexTasks = input.tasks.filter(task => 
        task.details && task.details.length > 500
      );
      
      if (complexTasks.length > input.tasks.length * 0.3) {
        warnings.push(`${Math.round(complexTasks.length / input.tasks.length * 100)}% of tasks are very detailed - consider breaking down complex implementations`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };

  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation failed with error: ${(error as Error).message}`],
      warnings: [],
    };
  }
}

/**
 * Validates a complete project plan with enhanced AI-powered analysis
 */
export async function validateProjectPlanWithAI(
  input: ValidateProjectPlanInput & { apiKey?: string; model?: string }
): Promise<ValidationResult> {
  
  try {
    // First run standard validation
    const basicValidation = await validateCompleteProjectPlan(input, 'comprehensive');
    
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    // Enhanced AI-powered validation would go here
    // This could ask the LLM to review the complete project plan for logical consistency,
    // completeness, and potential issues that automated checks might miss

    return basicValidation;

  } catch (error) {
    console.error('AI-powered validation failed:', error);
    
    // Fall back to basic validation
    const fallbackValidation = await validateCompleteProjectPlan(input, 'basic');
    
    return {
      ...fallbackValidation,
      warnings: [...fallbackValidation.warnings, 'AI-powered validation failed, falling back to basic checks'],
    };
  }
}


