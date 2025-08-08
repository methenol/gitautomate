/**
 * Simple test script to verify the unified project orchestrator works correctly
 */

import { generateUnifiedProjectPlan } from './src/ai/flows/unified-project-orchestrator';
import type { Task } from './src/types';

async function testUnifiedOrchestrator() {
  console.log('🧪 Testing Unified Project Orchestrator...');
  
  const testPRD = `
# Test E-commerce Platform

## Overview
Create a simple e-commerce platform with the following features:

## Core Requirements
1. User authentication (signup, login, logout)
2. Product catalog with search and filtering
3. Shopping cart functionality
4. Order management system
5. Payment processing integration
6. Admin dashboard for product management

## Technical Requirements
- React/Next.js frontend
- Node.js backend with REST API
- PostgreSQL database
- Stripe payment integration
- Responsive design
- Unit and integration tests
`;

  try {
    const result = await generateUnifiedProjectPlan({
      prd: testPRD,
      useTDD: false,
      // Note: This test will only work if GOOGLE_API_KEY is set in environment
    });
    
    console.log('✅ Orchestration completed successfully!');
    console.log(`📋 Generated ${result.tasks.length} tasks`);
    console.log(`🔗 Dependency graph created with ${Object.keys(result.context.dependencyGraph?.dependencies || {}).length} nodes`);
    console.log(`⚠️ Validation errors: ${result.validation.errors.length}`);
    console.log(`⚠️ Validation warnings: ${result.validation.warnings.length}`);
    
    // Check for key architectural components
    const hasArchitecture = result.context.architecture.length > 0;
    const hasFileStructure = result.context.fileStructure.length > 0;
    const hasSpecifications = result.context.specifications.length > 0;
    const hasTasks = result.tasks.length > 0;
    
    console.log(`🏗️ Architecture generated: ${hasArchitecture ? '✅' : '❌'}`);
    console.log(`📁 File structure generated: ${hasFileStructure ? '✅' : '❌'}`);
    console.log(`📋 Specifications generated: ${hasSpecifications ? '✅' : '❌'}`);
    console.log(`✅ Tasks generated: ${hasTasks ? '✅' : '❌'}`);
    
    // Check for dependency awareness
    const tasksWithDependencies = result.tasks.filter((task: Task) => task.dependencies && task.dependencies.length > 0);
    console.log(`🔗 Tasks with dependencies: ${tasksWithDependencies.length}/${result.tasks.length}`);
    
    // Check execution order
    const hasExecutionOrder = result.executionOrder.length === result.tasks.length;
    console.log(`📋 Execution order defined: ${hasExecutionOrder ? '✅' : '❌'}`);
    
    // Sample output
    console.log('\n📋 Sample Tasks:');
    result.tasks.slice(0, 3).forEach((task: Task, index: number) => {
      console.log(`${index + 1}. ${task.title}`);
      if (task.dependencies && task.dependencies.length > 0) {
        console.log(`   Dependencies: ${task.dependencies.join(', ')}`);
      }
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Only run if executed directly (not imported)
if (require.main === module) {
  testUnifiedOrchestrator()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testUnifiedOrchestrator };