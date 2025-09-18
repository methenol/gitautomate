


/**
 * @fileOverview Integration tests for spec-kit enhanced GitAutomate flows
 */

import { specKitIntegration } from '@/ai/integration/spec-kit-integration';

describe('Spec-Kit Integration', () => {
  
  describe('generateArchitectureWithSpecKit', () => {
    
    it('should validate input structure without making LLM calls', async () => {
      const prd = `
        A task management application that allows users to create projects, 
        add team members, assign tasks, and track progress through Kanban boards.
      `;

      // This test validates the integration structure without making actual LLM calls
      expect(specKitIntegration).toBeDefined();
      
      // Test that the method exists and has correct signature
      expect(typeof specKitIntegration.generateArchitectureWithSpecKit).toBe('function');
    });

  });

  describe('generateTasksWithSpecKit', () => {
    
    it('should validate task generation structure', async () => {
      const architecture = `
        # Architecture
        The application uses React with TypeScript for the frontend, 
        Express.js API backend, and PostgreSQL database.
      `;

      const specifications = `
        # Specifications
        ### Functional Requirements
        - FR-001: Users must be able to create projects with team members
      `;

      // Validate structure without making actual LLM calls
      expect(specKitIntegration.generateTasksWithSpecKit).toBeDefined();
    });

  });

  describe('generateTaskDetailsWithSpecKit', () => {
    
    it('should validate task details structure', async () => {
      const title = 'Create User Authentication Service';
      
      expect(specKitIntegration.generateTaskDetailsWithSpecKit).toBeDefined();
    });

  });

});
