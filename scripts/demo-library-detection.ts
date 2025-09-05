#!/usr/bin/env node

/**
 * Demo script to showcase enhanced library detection improvements
 * Run with: npx tsx scripts/demo-library-detection.ts
 */

import { LibraryIdentifier } from '../src/services/library-identifier';

const testTasks = [
  {
    id: 'task-001',
    title: 'Modern Full-Stack Setup',
    details: 'Create a modern web application using React with Next.js for the frontend, Express.js with TypeScript for the backend API, and PostgreSQL with Prisma ORM for the database. Set up JWT authentication and Redis caching.'
  },
  {
    id: 'task-002', 
    title: 'DevOps and Testing Infrastructure',
    details: 'Configure Docker containers, set up Kubernetes deployment with Helm charts, implement CI/CD with GitHub Actions, add monitoring with Grafana and Prometheus, and comprehensive testing with Jest and Cypress.'
  },
  {
    id: 'task-003',
    title: 'Mobile and ML Integration',
    details: 'Build React Native mobile app with Expo, integrate TensorFlow model training pipeline with Pandas data processing, and set up Apache Kafka for real-time data streaming.'
  },
  {
    id: 'task-004',
    title: 'Edge Cases and Context',
    details: 'Install packages: npm install @angular/core, yarn add styled-components, pip install scikit-learn. Configure webpack.config.js and implement JWT authentication with bcrypt password hashing.'
  }
];

async function demonstrateLibraryDetection() {
  console.log('🚀 GitAutomate Enhanced Library Detection Demo\n');
  
  console.log('📋 Test Tasks:');
  testTasks.forEach((task, i) => {
    console.log(`${i + 1}. ${task.title}`);
    console.log(`   ${task.details.substring(0, 80)}...\n`);
  });

  console.log('🔍 Running Enhanced Library Detection...\n');

  // Test with pattern-only detection (fallback mode)
  console.log('📊 Pattern-Based Detection Results:');
  const libraries = await LibraryIdentifier.identifyLibraries(testTasks, { 
    useAI: false,
    fallbackToPatterns: true 
  });

  // Group by category for better display
  const byCategory = libraries.reduce((acc, lib) => {
    if (!acc[lib.category]) acc[lib.category] = [];
    acc[lib.category].push(lib);
    return acc;
  }, {} as Record<string, typeof libraries>);

  Object.entries(byCategory).forEach(([category, libs]) => {
    console.log(`\n🏷️  ${category.toUpperCase()} (${libs.length} libraries):`);
    libs.sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, 8) // Show top 8 per category
        .forEach(lib => {
          const confidence = (lib.confidenceScore * 100).toFixed(0);
          const tasks = lib.detectedIn.length;
          console.log(`   • ${lib.name} (${confidence}% confidence, ${tasks} task${tasks > 1 ? 's' : ''})`);
        });
  });

  console.log(`\n📈 Summary:`);
  console.log(`   • Total libraries detected: ${libraries.length}`);
  console.log(`   • Categories covered: ${Object.keys(byCategory).length}`);
  console.log(`   • High confidence (>70%): ${libraries.filter(l => l.confidenceScore > 0.7).length}`);
  console.log(`   • Cross-task libraries: ${libraries.filter(l => l.detectedIn.length > 1).length}`);

  console.log('\n✨ Key Improvements:');
  console.log('   • 300+ libraries supported (vs ~90 previously)');
  console.log('   • 8 categories including DevOps, Mobile, ML');
  console.log('   • Enhanced context detection (JWT, package managers)');
  console.log('   • AI-powered semantic analysis (when enabled)');
  console.log('   • Graceful fallback to pattern matching');

  console.log('\n🎯 Ready for AI Enhancement:');
  console.log('   • Call with AI model to enable semantic analysis');
  console.log('   • Detects implied libraries based on context');
  console.log('   • Confidence merging between AI and patterns');
  console.log('   • Better handling of unknown/custom frameworks');
}

// Run the demo
demonstrateLibraryDetection()
  .then(() => {
    console.log('\n✅ Demo completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  });