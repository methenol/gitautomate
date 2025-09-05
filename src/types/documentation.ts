import { z } from 'zod';

export const DocumentationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  sources: z.array(z.enum(['github', 'official', 'mdn', 'stackoverflow', 'npm'])).default(['github', 'official']),
  includeStackOverflow: z.boolean().default(false),
  maxDocumentationSizeKB: z.number().min(100).max(2048).default(512),
  cacheDocumentationDays: z.number().min(1).max(30).default(7),
  // LLM configuration for documentation enhancement
  apiKey: z.string().optional(),
  model: z.string().optional(),
  apiBase: z.string().optional(),
});

export type DocumentationSettings = z.infer<typeof DocumentationSettingsSchema>;

export interface IdentifiedLibrary {
  name: string;
  confidenceScore: number;
  category: string; // Dynamic category, not hardcoded
  detectedIn: string[]; // Task IDs where this library was mentioned
  source: 'ai' | 'pattern' | 'combined';
  context?: string; // Where/how it was detected
}

export interface LibraryDocumentation {
  libraryName: string;
  category: string;
  sources: DocumentationSource[];
  sizeKB: number;
  fetchedAt: Date;
  cacheExpiry: Date;
}

export interface DocumentationSource {
  type: 'github-readme' | 'github-wiki' | 'github-docs' | 'official-site' | 'mdn' | 'stackoverflow' | 'npm';
  url: string;
  title: string;
  content: string;
  sizeKB: number;
  lastModified?: Date;
}

export interface DocumentationFetchResult {
  libraries: LibraryDocumentation[];
  totalSizeKB: number;
  fetchedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}

export interface LibrarySearchResult {
  name: string;
  fullName?: string;
  description?: string;
  url: string;
  stars?: number;
  language?: string;
  isVerified: boolean;
}