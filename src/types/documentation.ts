import { z } from 'zod';

export const LibraryDocumentationSchema = z.object({
  name: z.string(),
  source: z.enum(['github', 'official', 'mdn', 'npm', 'pypi', 'maven']),
  url: z.string(),
  content: z.string(),
  contentType: z.enum(['markdown', 'html', 'text']),
  lastFetched: z.string(), // ISO date string
  sizeKB: z.number(),
});

export type LibraryDocumentation = z.infer<typeof LibraryDocumentationSchema>;

export const IdentifiedLibrarySchema = z.object({
  name: z.string(),
  confidenceScore: z.number().min(0).max(1), // 0-1 confidence score
  category: z.enum(['frontend', 'backend', 'database', 'testing', 'utility', 'unknown']),
  detectedIn: z.array(z.string()), // Task IDs where this library was detected
});

export type IdentifiedLibrary = z.infer<typeof IdentifiedLibrarySchema>;

export const DocumentationSettingsSchema = z.object({
  sources: z.array(z.enum(['github', 'official', 'mdn', 'npm'])).default(['github', 'official']),
  includeStackOverflow: z.boolean().default(false),
  maxDocumentationSizeKB: z.number().min(100).max(2048).default(512),
  cacheDocumentationDays: z.number().min(1).max(30).default(7),
  enabled: z.boolean().default(true),
});

export type DocumentationSettings = z.infer<typeof DocumentationSettingsSchema>;

export const DocumentationFetchResultSchema = z.object({
  libraries: z.array(LibraryDocumentationSchema),
  totalSizeKB: z.number(),
  fetchedCount: z.number(),
  skippedCount: z.number(),
  errorCount: z.number(),
  errors: z.array(z.string()),
});

export type DocumentationFetchResult = z.infer<typeof DocumentationFetchResultSchema>;