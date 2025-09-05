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
  // AI configuration for library extraction
  aiConfig: z.object({
    apiKey: z.string().optional(),
    model: z.string().optional(),
    apiBase: z.string().optional(),
    useAI: z.boolean().default(true),
  }).optional(),
});

type FetchDocumentationRequest = z.infer<typeof FetchDocumentationRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    const body: FetchDocumentationRequest = await request.json();
    const { tasks, settings, githubToken, aiConfig } = FetchDocumentationRequestSchema.parse(body);

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

    // Identify libraries mentioned in tasks using AI-enhanced extraction
    const identifiedLibraries = await LibraryIdentifier.identifyLibraries(tasks, {
      useAI: aiConfig?.useAI ?? true,
      apiKey: aiConfig?.apiKey,
      model: aiConfig?.model,
      apiBase: aiConfig?.apiBase,
      fallbackToPatterns: true, // Always use patterns as fallback/supplement
    });
    const filteredLibraries = LibraryIdentifier.filterLibraries(identifiedLibraries, {
      minConfidence: 0.5,
      maxCount: 15, // Limit to avoid overwhelming the export
    });

    if (filteredLibraries.length === 0) {
      return NextResponse.json({
        libraries: [],
        totalSizeKB: 0,
        fetchedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: ['No libraries identified in tasks'],
      });
    }

    // Fetch documentation for identified libraries
    const fetcher = new DocumentationFetcher(docSettings, githubToken);
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