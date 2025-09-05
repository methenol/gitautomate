import type { IdentifiedLibrary } from '@/types/documentation';
import { extractLibraries, type ExtractLibrariesInput } from '@/ai/flows/extract-libraries';

export class LibraryIdentifier {
  // Library patterns categorized by type - expanded to include more libraries
  private static readonly LIBRARY_PATTERNS = {
    frontend: [
      // React ecosystem
      'react', 'next', 'nextjs', 'gatsby', 'remix', 'redux', 'mobx', 'zustand', 'recoil',
      'react-router', 'react-router-dom', 'react-query', 'tanstack', 'swr', 'apollo-client',
      'chakra-ui', 'material-ui', 'mui', 'ant-design', 'antd', 'mantine', 'react-bootstrap',
      'tailwind', 'tailwindcss', 'styled-components', 'emotion', '@emotion', 'styled-jsx',
      
      // Vue ecosystem  
      'vue', 'vuejs', 'nuxt', 'nuxtjs', 'vuex', 'pinia', 'vue-router', 'quasar', 'vuetify',
      'vite', 'vuepress', 'gridsome',
      
      // Angular ecosystem
      'angular', '@angular', 'rxjs', 'ngrx', 'angular-material', 'ng-bootstrap', 'primeng',
      
      // Other frontend frameworks
      'svelte', 'sveltekit', 'solid', 'solidjs', 'lit', 'stencil', 'preact', 'alpine',
      'htmx', 'stimulus', 'hotwire',
      
      // Build tools and bundlers
      'webpack', 'vite', 'rollup', 'parcel', 'esbuild', 'turbopack', 'snowpack', 'rspack',
      
      // CSS frameworks and libraries
      'bootstrap', 'bulma', 'foundation', 'semantic-ui', 'materialize', 'purecss',
      'windicss', 'unocss', 'twind', 'sass', 'scss', 'less', 'stylus', 'postcss',
      
      // UI component libraries
      'storybook', 'react-select', 'react-table', 'react-hook-form', 'formik', 'react-dnd',
      'framer-motion', 'react-spring', 'react-transition-group', 'lottie-react',
      
      // Charts and visualization
      'chart.js', 'chartjs', 'd3', 'd3js', 'recharts', 'victory', 'plotly', 'highcharts',
      'three', 'threejs', 'babylon', 'babylonjs',
    ],
    backend: [
      // Node.js
      'express', 'fastify', 'koa', 'hapi', 'nestjs', 'adonis', 'meteor', 'sails',
      'socket.io', 'ws', 'graphql', 'apollo-server', 'apollo-server-express',
      'cors', 'helmet', 'morgan', 'compression', 'body-parser', 'cookie-parser',
      'jsonwebtoken', 'passport', 'bcrypt', 'bcryptjs', 'nodemailer', 'multer',
      
      // Database ORMs and query builders
      'prisma', 'typeorm', 'sequelize', 'mongoose', 'knex', 'objection', 'bookshelf',
      'waterline', 'massive', 'pg', 'mysql2', 'sqlite3', 'tedious',
      
      // Python
      'django', 'flask', 'fastapi', 'tornado', 'pyramid', 'celery', 'gunicorn', 'uvicorn',
      'sqlalchemy', 'django-rest-framework', 'drf', 'requests', 'aiohttp', 'starlette',
      
      // Java
      'spring', 'spring-boot', 'spring-data', 'spring-security', 'hibernate', 'struts',
      'jersey', 'micronaut', 'quarkus', 'vert.x', 'play', 'dropwizard',
      
      // .NET
      'dotnet', '.net', 'asp.net', 'entity-framework', 'signalr', 'blazor',
      
      // Go
      'gin', 'echo', 'fiber', 'gorilla', 'beego', 'iris', 'chi', 'mux',
      
      // Rust
      'actix', 'rocket', 'warp', 'axum', 'tide', 'tower',
      
      // PHP
      'laravel', 'symfony', 'codeigniter', 'zend', 'yii', 'cakephp', 'slim', 'lumen',
      
      // Ruby
      'rails', 'sinatra', 'grape', 'roda', 'hanami',
      
      // Serverless and cloud
      'serverless', 'aws-sdk', 'aws-lambda', 'azure-functions', 'gcp-functions',
      
      // Messaging and queuing
      'kafka', 'rabbitmq', 'activemq', 'zeromq', 'nats', 'pulsar',
    ],
    database: [
      // Relational databases
      'postgresql', 'postgres', 'mysql', 'sqlite', 'mariadb', 'oracle', 'sqlserver',
      'cockroachdb', 'planetscale', 'neon', 'supabase', 'vitess',
      
      // NoSQL databases
      'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'firestore',
      'couchdb', 'arangodb', 'neo4j', 'orientdb', 'rethinkdb',
      
      // In-memory and caching
      'memcached', 'hazelcast', 'ignite', 'etcd', 'consul',
      
      // Time series and analytics
      'influxdb', 'timescaledb', 'clickhouse', 'druid', 'pinot',
      
      // Graph databases
      'dgraph', 'janusgraph', 'tigergraph', 'memgraph',
    ],
    testing: [
      // JavaScript testing
      'jest', 'mocha', 'chai', 'jasmine', 'vitest', 'ava', 'tape', 'qunit',
      'sinon', 'nock', 'supertest', 'msw', 'jest-dom', 'jsdom',
      
      // End-to-end testing
      'cypress', 'playwright', 'selenium', 'puppeteer', 'webdriver', 'testcafe',
      'nightwatch', 'protractor', 'codecept',
      
      // React testing
      'testing-library', 'react-testing-library', 'enzyme', 'react-test-renderer',
      
      // Python testing
      'pytest', 'unittest', 'nose', 'behave', 'locust', 'factory-boy',
      
      // Java testing
      'junit', 'junit5', 'testng', 'mockito', 'powermock', 'wiremock', 'rest-assured',
      
      // API testing
      'postman', 'newman', 'insomnia', 'karate', 'pact',
      
      // Performance testing
      'k6', 'artillery', 'jmeter', 'gatling', 'loader.io',
      
      // Visual testing
      'chromatic', 'percy', 'applitools', 'backstop',
    ],
    utility: [
      // General utilities
      'lodash', 'underscore', 'ramda', 'immer', 'rxjs', 'most',
      
      // Date and time
      'moment', 'dayjs', 'date-fns', 'luxon', 'temporal',
      
      // HTTP clients
      'axios', 'fetch', 'got', 'ky', 'superagent', 'request', 'node-fetch',
      
      // Validation
      'joi', 'yup', 'zod', 'ajv', 'validator', 'class-validator', 'superstruct',
      
      // Unique IDs and crypto
      'uuid', 'nanoid', 'shortid', 'cuid', 'bcrypt', 'bcryptjs', 'argon2',
      'crypto-js', 'node-rsa', 'jose',
      
      // Parsing and serialization
      'csv-parser', 'csv-writer', 'xlsx', 'pdf-lib', 'sharp', 'jimp',
      'yaml', 'toml', 'ini', 'xml2js', 'fast-xml-parser',
      
      // Logging
      'winston', 'bunyan', 'pino', 'log4js', 'consola', 'signale',
      
      // Environment and config
      'dotenv', 'config', 'convict', 'nconf', 'rc',
      
      // Process management
      'pm2', 'forever', 'nodemon', 'supervisor', 'concurrently',
      
      // File system utilities
      'fs-extra', 'glob', 'minimatch', 'chokidar', 'rimraf', 'mkdirp',
    ],
    devops: [
      // Containerization
      'docker', 'docker-compose', 'kubernetes', 'k8s', 'helm', 'skaffold',
      'podman', 'buildah', 'containerd',
      
      // CI/CD
      'jenkins', 'gitlab-ci', 'github-actions', 'travis', 'circleci', 'azure-devops',
      'teamcity', 'bamboo', 'drone', 'tekton', 'argo',
      
      // Infrastructure as Code
      'terraform', 'ansible', 'puppet', 'chef', 'saltstack', 'pulumi',
      'cloudformation', 'arm-templates', 'cdk',
      
      // Monitoring and observability
      'prometheus', 'grafana', 'elasticsearch', 'kibana', 'logstash', 'fluentd',
      'jaeger', 'zipkin', 'newrelic', 'datadog', 'splunk', 'sentry',
      
      // Service mesh
      'istio', 'linkerd', 'consul-connect', 'envoy',
      
      // Package management
      'npm', 'yarn', 'pnpm', 'pip', 'poetry', 'maven', 'gradle', 'sbt',
      'composer', 'bundler', 'cargo', 'go-mod',
    ],
    mobile: [
      // React Native
      'react-native', 'expo', 'metro', 'flipper',
      
      // Flutter
      'flutter', 'dart',
      
      // Ionic
      'ionic', 'capacitor', 'cordova', 'phonegap',
      
      // Native iOS
      'swift', 'objective-c', 'xcode', 'cocoapods', 'carthage',
      
      // Native Android
      'kotlin', 'android', 'gradle', 'jetpack',
      
      // Cross-platform
      'xamarin', 'unity', 'unreal', 'titanium', 'nativescript',
    ],
    ml: [
      // Python ML/AI
      'tensorflow', 'keras', 'pytorch', 'scikit-learn', 'pandas', 'numpy',
      'matplotlib', 'seaborn', 'plotly', 'jupyter', 'opencv', 'pillow',
      'nltk', 'spacy', 'transformers', 'huggingface', 'langchain',
      
      // JavaScript ML
      'tensorflow.js', 'brain.js', 'ml-matrix', 'synaptic',
      
      // R
      'r', 'rstudio', 'shiny', 'ggplot2', 'dplyr',
      
      // Big Data (without Kafka, moved to backend)
      'spark', 'hadoop', 'airflow', 'dask', 'ray',
    ],
  };

  /**
   * Identifies libraries mentioned in task details and titles using AI-powered analysis
   * Falls back to pattern matching if AI analysis fails
   */
  static async identifyLibraries(
    tasks: Array<{ id: string; title: string; details: string }>,
    options: {
      useAI?: boolean;
      apiKey?: string;
      model?: string;
      apiBase?: string;
      fallbackToPatterns?: boolean;
    } = {}
  ): Promise<IdentifiedLibrary[]> {
    const { 
      useAI = true, 
      apiKey, 
      model, 
      apiBase, 
      fallbackToPatterns = true 
    } = options;

    let aiResults: IdentifiedLibrary[] = [];
    let patternResults: IdentifiedLibrary[] = [];

    // Try AI-based extraction first if enabled
    if (useAI && model) {
      try {
        console.log('🤖 Using AI-powered library extraction...');
        const aiOutput = await extractLibraries({ tasks }, apiKey, model, apiBase);
        
        aiResults = aiOutput.libraries.map(lib => ({
          name: lib.name,
          confidenceScore: lib.confidence,
          category: lib.category as IdentifiedLibrary['category'],
          detectedIn: lib.taskIds,
          source: 'ai' as const,
          context: lib.context,
        }));

        console.log(`✅ AI extracted ${aiResults.length} libraries`);
      } catch (error) {
        console.warn('❌ AI library extraction failed:', error);
        if (!fallbackToPatterns) {
          throw error;
        }
      }
    }

    // Use pattern matching if AI failed or as fallback/supplement
    if (aiResults.length === 0 || fallbackToPatterns) {
      console.log('🔍 Using pattern-based library extraction...');
      patternResults = this.identifyLibrariesByPattern(tasks);
      console.log(`✅ Pattern matching found ${patternResults.length} libraries`);
    }

    // Merge results, prioritizing AI results but supplementing with patterns
    const mergedResults = this.mergeLibraryResults(aiResults, patternResults);
    
    console.log(`📚 Total libraries identified: ${mergedResults.length}`);
    return mergedResults;
  }

  /**
   * Original pattern-based library identification (renamed for clarity)
   */
  static identifyLibrariesByPattern(tasks: Array<{ id: string; title: string; details: string }>): IdentifiedLibrary[] {
    const identified = new Map<string, IdentifiedLibrary>();

    for (const task of tasks) {
      const text = `${task.title} ${task.details}`.toLowerCase();
      
      // Check each category
      for (const [category, libraries] of Object.entries(this.LIBRARY_PATTERNS)) {
        for (const library of libraries) {
          const confidence = this.calculateConfidence(text, library);
          
          if (confidence > 0.3) { // Minimum confidence threshold
            const key = library;
            
            if (identified.has(key)) {
              const existing = identified.get(key)!;
              existing.confidenceScore = Math.max(existing.confidenceScore, confidence);
              existing.detectedIn.push(task.id);
            } else {
              identified.set(key, {
                name: library,
                confidenceScore: confidence,
                category: category as IdentifiedLibrary['category'],
                detectedIn: [task.id],
                source: 'pattern' as const,
              });
            }
          }
        }
      }
    }

    // Sort by confidence score descending
    return Array.from(identified.values())
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Calculate confidence score for library detection
   */
  private static calculateConfidence(text: string, library: string): number {
    let confidence = 0;
    
    // Exact word match
    const wordBoundaryRegex = new RegExp(`\\b${library.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const exactMatches = (text.match(wordBoundaryRegex) || []).length;
    confidence += exactMatches * 0.4;
    
    // Special handling for JWT/jsonwebtoken
    if (library === 'jsonwebtoken' || library === 'jwt') {
      if (/\bjwt\b/gi.test(text) || /json.*web.*token/gi.test(text)) {
        confidence += 0.4;
      }
    }
    
    // Package/import patterns
    const importPatterns = [
      `import.*${library}`,
      `from.*${library}`,
      `require.*${library}`,
      `@${library}`,
      `npm.*${library}`,
      `yarn.*${library}`,
      `pip.*${library}`,
      `dependency.*${library}`,
    ];
    
    for (const pattern of importPatterns) {
      if (new RegExp(pattern, 'i').test(text)) {
        confidence += 0.3;
      }
    }
    
    // Context patterns
    const contextPatterns = [
      `setup.*${library}`,
      `configure.*${library}`,
      `implement.*${library}`,
      `install.*${library}`,
      `using.*${library}`,
      `with.*${library}`,
    ];
    
    for (const pattern of contextPatterns) {
      if (new RegExp(pattern, 'i').test(text)) {
        confidence += 0.2;
      }
    }
    
    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Filter libraries by minimum confidence and category
   */
  static filterLibraries(
    libraries: IdentifiedLibrary[], 
    options: {
      minConfidence?: number;
      categories?: IdentifiedLibrary['category'][];
      maxCount?: number;
    } = {}
  ): IdentifiedLibrary[] {
    const { minConfidence = 0.5, categories, maxCount = 20 } = options;
    
    let filtered = libraries.filter(lib => lib.confidenceScore >= minConfidence);
    
    if (categories && categories.length > 0) {
      filtered = filtered.filter(lib => categories.includes(lib.category));
    }
    
    return filtered.slice(0, maxCount);
  }

  /**
   * Merge AI and pattern-based results, removing duplicates and combining confidence scores
   */
  private static mergeLibraryResults(
    aiResults: IdentifiedLibrary[],
    patternResults: IdentifiedLibrary[]
  ): IdentifiedLibrary[] {
    const merged = new Map<string, IdentifiedLibrary>();

    // Add AI results first (higher priority)
    for (const library of aiResults) {
      merged.set(library.name.toLowerCase(), {
        ...library,
        source: 'ai' as const,
      });
    }

    // Add pattern results, merging with AI results where they exist
    for (const library of patternResults) {
      const key = library.name.toLowerCase();
      
      if (merged.has(key)) {
        const existing = merged.get(key)!;
        // Combine confidence scores (weighted average)
        existing.confidenceScore = (existing.confidenceScore * 0.7) + (library.confidenceScore * 0.3);
        // Merge detected tasks
        existing.detectedIn = [...new Set([...existing.detectedIn, ...library.detectedIn])];
        existing.source = 'combined' as const;
      } else {
        merged.set(key, {
          ...library,
          source: 'pattern' as const,
        });
      }
    }

    // Sort by confidence score descending
    return Array.from(merged.values())
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
}