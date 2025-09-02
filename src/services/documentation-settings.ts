

/**
 * Documentation Fetching Settings Configuration
 */

import { z } from 'zod';

export const documentationSettingsSchema = z.object({
  // Documentation sources configuration
  documentationSources: z.enum(['github-only', 'multi-source']).default('multi-source'),
  
  // Stack Overflow integration
  includeStackOverflow: z.boolean().default(true),
  
  // Documentation size limits (to prevent overly large exports)
  maxDocumentationSizeKB: z.number().min(100).max(1024).default(512),
  
  // Cache configuration
  cacheDocumentationDays: z.number().min(1).max(30).default(7),
  
  // Rate limiting configuration
  requestDelayMs: z.number().min(100).max(5000).default(200),
  
  // Library identification settings
  minimumConfidenceScore: z.number().min(0.1).max(1.0).default(0.5),
  
  // Export settings
  includeDocumentationInExports: z.boolean().default(true),
  createReferenceFolderStructure: z.enum(['flat', 'by-category']).default('by-category'),
  
  // Advanced settings
  skipLibrariesWithNoDocumentation: z.boolean().default(false),
  maxLibrariesPerExport: z.number().min(1).max(50).default(10),
});

export type DocumentationSettings = z.infer<typeof documentationSettingsSchema>;

/**
 * Default settings for documentation fetching
 */
export const defaultDocumentationSettings: DocumentationSettings = {
  documentationSources: 'multi-source',
  includeStackOverflow: true,
  maxDocumentationSizeKB: 512,
  cacheDocumentationDays: 7,
  requestDelayMs: 200,
  minimumConfidenceScore: 0.5,
  includeDocumentationInExports: true,
  createReferenceFolderStructure: 'by-category',
  skipLibrariesWithNoDocumentation: false,
  maxLibrariesPerExport: 10
};

/**
 * Validation function for settings
 */
export const validateDocumentationSettings = (settings: unknown): DocumentationSettings => {
  return documentationSettingsSchema.parse(settings);
};

/**
 * Migration function for updating settings from older versions
 */
export const migrateDocumentationSettings = (oldSettings: Record<string, unknown>): DocumentationSettings => {
  // Handle migration from older versions if needed
  const migrated = { ...oldSettings };
  
  // Ensure default values for any missing fields
  if (!migrated.documentationSources) {
    migrated.documentationSources = defaultDocumentationSettings.documentationSources;
  }
  
  if (typeof migrated.includeStackOverflow !== 'boolean') {
    migrated.includeStackOverflow = defaultDocumentationSettings.includeStackOverflow;
  }
  
  if (typeof migrated.maxDocumentationSizeKB !== 'number' || 
      !Number.isFinite(migrated.maxDocumentationSizeKB)) {
    migrated.maxDocumentationSizeKB = defaultDocumentationSettings.maxDocumentationSizeKB;
  }
  
  return documentationSettingsSchema.parse(migrated);
};

