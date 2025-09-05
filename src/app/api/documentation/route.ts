import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LibraryIdentifier } from '@/services/library-identifier';
import { DocumentationFetcher } from '@/services/documentation-fetcher';
import { DocumentationSettingsSchema } from '@/types/documentation';

const FetchDocumentationRequestSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    details: z.string(),
  })),
  settings: DocumentationSettingsSchema.optional(),
  githubToken: z.string().optional(),
  // Existing LLM configuration from main application settings
  apiKey: z.string().optional(),
  llmModel: z.string().optional(),
  apiBase: z.string().optional(),
});

type FetchDocumentationRequest = z.infer<typeof FetchDocumentationRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    const body: FetchDocumentationRequest = await request.json();
    const { tasks, settings, githubToken, apiKey, llmModel, apiBase } = FetchDocumentationRequestSchema.parse(body);

    // Use default settings if none provided
    const docSettings = settings || {
      sources: ['github', 'official'],
      includeStackOverflow: false,
      maxDocumentationSizeKB: 512,
      cacheDocumentationDays: 7,
      enabled: true,
    };

    if (!docSettings.enabled) {
      return NextResponse.json({
        libraries: [],
        totalSizeKB: 0,
        fetchedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      });
    }

    // Identify libraries mentioned in tasks using LLM extraction
    const identifiedLibraries = await LibraryIdentifier.identifyLibraries(
      tasks,
      apiKey,
      llmModel,
      apiBase
    );
    const filteredLibraries = LibraryIdentifier.filterLibraries(identifiedLibraries, {
      minConfidence: 0.6,
      maxCount: 15, // Limit to avoid overwhelming the export
    });

    if (filteredLibraries.length === 0) {
      return NextResponse.json({
        libraries: [],
        totalSizeKB: 0,
        fetchedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: ['No valid libraries identified in tasks'],
      });
    }

    // Prepare LLM configuration if provided
    const llmConfig = (apiKey && llmModel && apiBase) ? {
      apiKey,
      model: llmModel,
      apiBase,
    } : undefined;

    // Fetch documentation for identified libraries
    const fetcher = new DocumentationFetcher(docSettings, githubToken, llmConfig);
    const fetchResult = await fetcher.fetchLibraryDocumentation(filteredLibraries);

    return NextResponse.json(fetchResult);

  } catch (error) {
    console.error('Documentation fetching error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}