import { LibraryIdentifier } from '@/services/library-identifier';

describe('LibraryIdentifier Real-World Integration', () => {
  it('should extract libraries from realistic project tasks', async () => {
    const realWorldTasks = [
      {
        id: 'task-1',
        title: 'Setup Frontend with React and TypeScript',
        details: `
          - Initialize React project with TypeScript
          - Install dependencies: npm install react react-dom @types/react @types/react-dom typescript
          - Setup routing with react-router-dom
          - Add UI components with Material-UI or Ant Design
          - Configure Webpack for bundling
        `
      },
      {
        id: 'task-2', 
        title: 'Backend API Development',
        details: `
          - Create Express.js server with TypeScript
          - Setup database connection with Mongoose (MongoDB)
          - Add authentication with JWT using jsonwebtoken
          - Implement rate limiting with express-rate-limit
          - Add request validation with Joi
          - Setup testing with Jest and Supertest
        `
      },
      {
        id: 'task-3',
        title: 'DevOps and Deployment',
        details: `
          - Containerize application with Docker
          - Setup CI/CD pipeline with GitHub Actions
          - Deploy to AWS using Terraform
          - Setup monitoring with Prometheus and Grafana
          - Configure reverse proxy with Nginx
        `
      },
      {
        id: 'task-4',
        title: 'Mobile App Development',
        details: `
          - Build mobile app using react-native
          - Add navigation with @react-navigation/native
          - Implement state management with redux-toolkit
          - Add push notifications with firebase
          - Setup analytics with react-native-analytics
        `
      }
    ];

    const libraries = await LibraryIdentifier.identifyLibraries(realWorldTasks);
    
    // Verify we extracted meaningful libraries
    expect(libraries.length).toBeGreaterThan(10);
    
    // Check for expected frontend libraries
    const frontendLibs = libraries.filter(lib => lib.category === 'frontend');
    expect(frontendLibs.map(lib => lib.name)).toContain('react');
    expect(frontendLibs.map(lib => lib.name)).toContain('typescript');
    
    // Check for expected backend libraries  
    const backendLibs = libraries.filter(lib => lib.category === 'backend');
    expect(backendLibs.map(lib => lib.name)).toContain('express');
    expect(backendLibs.map(lib => lib.name)).toContain('jsonwebtoken');
    
    // Check for expected database libraries
    const databaseLibs = libraries.filter(lib => lib.category === 'database');
    expect(databaseLibs.map(lib => lib.name)).toContain('mongoose');
    
    // Check for expected testing libraries
    const testingLibs = libraries.filter(lib => lib.category === 'testing');
    expect(testingLibs.map(lib => lib.name)).toContain('jest');
    
    // Check for expected DevOps tools
    const devopsLibs = libraries.filter(lib => lib.category === 'devops');
    expect(devopsLibs.map(lib => lib.name)).toContain('docker');
    expect(devopsLibs.map(lib => lib.name)).toContain('terraform');
    expect(devopsLibs.map(lib => lib.name)).toContain('nginx');
    
    // Check for expected mobile libraries
    const mobileLibs = libraries.filter(lib => lib.category === 'mobile');
    expect(mobileLibs.map(lib => lib.name)).toContain('react-native');
    
    // Verify confidence scores are reasonable
    const highConfidenceLibs = libraries.filter(lib => lib.confidenceScore >= 0.8);
    expect(highConfidenceLibs.length).toBeGreaterThan(5);
    
    // Verify task associations
    const reactLib = libraries.find(lib => lib.name === 'react');
    expect(reactLib?.detectedIn).toContain('task-1');
    expect(reactLib?.detectedIn).toContain('task-4'); // Should be detected in both frontend and mobile tasks
    
    const expressLib = libraries.find(lib => lib.name === 'express');
    expect(expressLib?.detectedIn).toContain('task-2');
    
    console.log('Detected Libraries:');
    libraries.forEach(lib => {
      console.log(`- ${lib.name} (${lib.category}) - Confidence: ${lib.confidenceScore.toFixed(2)} - Tasks: ${lib.detectedIn.join(', ')}`);
    });
  });

  it('should handle edge cases and avoid false positives', async () => {
    const edgeCaseTasks = [
      {
        id: 'edge-1',
        title: 'General Planning and Documentation',
        details: `
          - Create project documentation
          - Define user requirements and specifications
          - Plan the architecture and design patterns
          - Setup development environment guidelines
        `
      },
      {
        id: 'edge-2',
        title: 'Code with Misleading Context',
        details: `
          - File named config.font_path.sprite should not be detected as library
          - Reference to basespriteRenderer.initialize() should not extract basespriteRenderer as a library
          - Variable named pygame.sprite.sprite should not be library
          - Common words like 'main', 'index', 'helper', 'utils' should be ignored
        `
      }
    ];

    const libraries = await LibraryIdentifier.identifyLibraries(edgeCaseTasks);
    
    // Should not extract invalid library names
    expect(libraries.map(lib => lib.name)).not.toContain('config.font_path.sprite');
    expect(libraries.map(lib => lib.name)).not.toContain('basespriteRenderer');
    expect(libraries.map(lib => lib.name)).not.toContain('pygame.sprite.sprite');
    expect(libraries.map(lib => lib.name)).not.toContain('main');
    expect(libraries.map(lib => lib.name)).not.toContain('index');
    expect(libraries.map(lib => lib.name)).not.toContain('helper');
    expect(libraries.map(lib => lib.name)).not.toContain('utils');
    
    // Should have very few or no valid libraries from these edge case tasks
    expect(libraries.length).toBeLessThan(3);
  });

  it('should properly categorize libraries based on context', async () => {
    const categorizationTasks = [
      {
        id: 'cat-1',
        title: 'Full Stack E-commerce Platform',
        details: `
          Frontend: React with next.js framework, styled-components for styling
          Backend: node.js with Express, GraphQL API
          Database: PostgreSQL with Prisma ORM
          Testing: Jest for unit tests, Cypress for e2e
          Mobile: react-native for iOS and Android
          ML: tensorflow.js for recommendation engine
          DevOps: Docker containers, Kubernetes orchestration
        `
      }
    ];

    const libraries = await LibraryIdentifier.identifyLibraries(categorizationTasks);
    
    // Group by category
    const byCategory = libraries.reduce((acc, lib) => {
      acc[lib.category] = acc[lib.category] || [];
      acc[lib.category].push(lib.name);
      return acc;
    }, {} as Record<string, string[]>);

    // Verify correct categorization (flexible checks)
    expect(byCategory.frontend).toContain('react');
    expect(byCategory.frontend?.includes('nextjs') || byCategory.frontend?.includes('next')).toBeTruthy();
    expect(byCategory.backend).toContain('express');
    expect(byCategory.backend?.includes('nodejs') || byCategory.backend?.includes('node')).toBeTruthy();
    expect(byCategory.database).toContain('postgresql');
    expect(byCategory.database).toContain('prisma');
    expect(byCategory.testing).toContain('jest');
    expect(byCategory.testing).toContain('cypress');
    expect(byCategory.mobile).toContain('react-native');
    expect(byCategory.ml?.includes('tensorflow') || byCategory.utility?.includes('tensorflow')).toBeTruthy();
    expect(byCategory.devops).toContain('docker');
    expect(byCategory.devops).toContain('kubernetes');

    console.log('Libraries by Category:');
    Object.entries(byCategory).forEach(([category, libs]) => {
      console.log(`${category}: ${libs.join(', ')}`);
    });
  });
});