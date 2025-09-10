/**
 * @fileOverview LiteLLM abstraction layer providing provider-agnostic LLM integration
 * 
 * This module provides a unified interface for LLM providers using the "provider/model" 
 * string format specified in issue #32. NO hardcoded providers or models.
 * All providers must use OpenAI-compatible endpoints.
 */

import { z } from 'zod';

// LiteLLM generate function interface  
interface GenerateOptions {
  model: string;
  prompt: string;
  output?: {
    schema: z.ZodSchema;
  };
  config?: {
    apiKey?: string;
    apiBase?: string;
    timeout?: number; // Timeout in milliseconds
    temperature?: number; // Temperature for LLM calls (0.0 - 2.0)
  };
}

// Convert response to JSON format expected by the schema
function parseResponse(response: string, schema?: z.ZodSchema): any {
  if (!schema) {
    return response;
  }

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(response);
    return schema.parse(parsed);
  } catch {
    // If JSON parsing fails, try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return schema.parse(parsed);
      } catch {
        // Fall through to create structured response
      }
    }
    
    // Detect what type of schema we're dealing with by testing required fields
    const result: any = {};
    let detectedFields: string[] = [];
    
    // Try to detect schema fields using safeParse with empty object
    try {
      const testResult = schema.safeParse({});
      if (!testResult.success) {
        detectedFields = testResult.error.issues
          .filter((issue: any) => issue.code === 'invalid_type' && issue.path.length === 1)
          .map((issue: any) => issue.path[0] as string);
      }
    } catch {
      // Fallback: try the old method
      if ((schema as any)._def?.shape) {
        detectedFields = Object.keys((schema as any)._def.shape);
      }
    }
    
    if (detectedFields.includes('architecture') && detectedFields.includes('specifications')) {
      // Architecture generation response
      const archMatch = response.match(/(?:architecture|Architecture)([\s\S]*?)(?:specification|Specification|$)/i);
      const specMatch = response.match(/(?:specification|Specification)([\s\S]*?)$/i);
      
      result.architecture = archMatch ? archMatch[1].trim() : response;
      result.specifications = specMatch ? specMatch[1].trim() : 'Please refer to the architecture above.';
    } else if (detectedFields.includes('tasks')) {
      // Task generation response - try to extract task list
      const lines = response.split('\n').filter(line => line.trim());
      const tasks = lines
        .filter(line => line.match(/^\d+\.|^-|\*|^Task/i))
        .map(line => ({
          title: line.replace(/^\d+\.\s*|^[-*]\s*|^Task\s*\d*:?\s*/i, '').trim(),
          details: ''
        }));
      
      result.tasks = tasks.length > 0 ? tasks : [{ title: response.substring(0, 100), details: '' }];
    } else if (detectedFields.includes('fileStructure')) {
      // File structure generation response - extract from markdown code blocks or direct tree
      let fileStructureContent = '';
      
      // Try to extract from markdown code blocks with common language identifiers
      const markdownMatch = response.match(/```(?:markdown|text|bash|tree)?\s*\n?([\s\S]*?)\n?```/);
      if (markdownMatch) {
        fileStructureContent = markdownMatch[1].trim();
      } else {
        // If no code block, look for tree-like structures directly in response
        const lines = response.split('\n');
        const treeLines = lines.filter(line => 
          line.includes('├') || line.includes('└') || line.includes('│') ||
          line.match(/^[a-zA-Z0-9-_.]+\/\s*$/) || 
          line.match(/^\s*[a-zA-Z0-9-_.]+\.(js|ts|tsx|jsx|py|html|css|md|json|yml|yaml)/)
        );
        
        if (treeLines.length > 0) {
          fileStructureContent = treeLines.join('\n');
        } else {
          // Fallback to using the entire response
          fileStructureContent = response.trim();
        }
      }
      
      result.fileStructure = fileStructureContent || 'Unable to extract file structure from response.';
    } else if (detectedFields.includes('context') && detectedFields.includes('implementationSteps') && detectedFields.includes('acceptanceCriteria')) {
      // Research task response - extract the three fields
      const contextMatch = response.match(/(?:context|Context)['":\s]*([\s\S]*?)(?:implementation|Implementation|acceptance|Acceptance|$)/i);
      const implementationMatch = response.match(/(?:implementation|Implementation)[^:]*[:\s]*([\s\S]*?)(?:acceptance|Acceptance|$)/i);
      const acceptanceMatch = response.match(/(?:acceptance|Acceptance)[^:]*[:\s]*([\s\S]*?)$/i);
      
      result.context = contextMatch ? contextMatch[1].trim() : 'Context information extracted from response.';
      result.implementationSteps = implementationMatch ? implementationMatch[1].trim() : 'Implementation steps extracted from response.';
      result.acceptanceCriteria = acceptanceMatch ? acceptanceMatch[1].trim() : 'Acceptance criteria extracted from response.';
    } else {
      // Generic response - use the first detected field as the response field
      const firstKey = detectedFields[0];
      if (firstKey) {
        result[firstKey] = response;
      } else {
        throw new Error(`Unable to determine schema structure for response: ${response.substring(0, 200)}...`);
      }
    }
    
    return schema.parse(result);
  }
}



// Validate and sanitize URL to prevent SSRF attacks
function validateAndSanitizeUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only HTTP and HTTPS protocols are allowed');
    }
    
    // Prevent access to localhost and private networks
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.') ||
        hostname.startsWith('192.168.') ||
        hostname === '::1' ||
        hostname.startsWith('fc00:') ||
        hostname.startsWith('fe80:')) {
      // Allow localhost only for development purposes
      if (process.env.NODE_ENV === 'development') {
        return baseUrl; // Preserve full URL including path for local development
      }
      throw new Error('Access to private networks is not allowed');
    }
    
    return baseUrl; // Preserve full URL including path
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }
    throw new Error('Invalid URL format');
  }
}

// Make OpenAI-compatible API call (works for all providers using OpenAI-compatible format)
async function makeOpenAICall(
  model: string,
  prompt: string,
  apiKey: string,
  baseUrl: string,
  timeout: number = 1200000, // Default 20 minutes
  temperature?: number
): Promise<string> {
  // Validate and sanitize the base URL to prevent SSRF
  const validatedBaseUrl = validateAndSanitizeUrl(baseUrl);
  const fullUrl = `${validatedBaseUrl}/chat/completions`;
  
  console.log('Making API call to:', fullUrl, 'with model:', model);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: temperature ?? 0.7,
        max_tokens: 32768,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
      throw new Error(`LLM API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

// LiteLLM implementation
export const ai = {
  async generate<T>(options: GenerateOptions): Promise<{ output: T }> {
    const { model, prompt, output, config } = options;
    
    try {
      // Sanitize config before logging to avoid exposing sensitive information
      const { apiKey: userApiKey, ...safeConfig } = config || {};
      console.log('Starting LiteLLM generation with model:', model, 'config:', safeConfig);
      
      // Require API key and base URL to be provided in config
      const apiKey = userApiKey;
      const baseUrl = config?.apiBase;
      
      if (!apiKey) {
        throw new Error(`API key is required. Please provide it in settings.`);
      }
      
      if (!baseUrl) {
        throw new Error(`API base URL is required. Please provide it in settings.`);
      }
      
      console.log('Using model:', model, 'baseUrl:', baseUrl);
      
      // Use OpenAI-compatible API for all providers - let the user configure their endpoint correctly
      const responseText = await makeOpenAICall(model, prompt, apiKey, baseUrl, config?.timeout);
      
      // Parse response according to schema
      const parsedOutput = parseResponse(responseText, output?.schema);
      
      return { output: parsedOutput as T };
      
    } catch (error) {
      console.error('LiteLLM generation error:', error instanceof Error ? error.message : String(error));
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error(`LLM API Error: ${error.message}`);
        }
        if (error.message.includes('not found') || error.message.includes('404')) {
          throw new Error(`Model '${model}' not found. Please check that the model name is correct and available on your provider.`);
        }
        if (error.message.includes('unauthorized') || error.message.includes('401')) {
          throw new Error(`Authentication failed. Please check your API key.`);
        }
        if (error.message.includes('parse')) {
          throw new Error(`The model returned an unexpected response format. Try a different model or adjust your prompt.`);
        }
        if (error.message.includes('fetch failed') || error.message.includes('getaddrinfo')) {
          throw new Error(`Network connection failed. Please check your API base URL and network connectivity. Error: ${error.message}`);
        }
      }
      
      throw error;
    }
  }
};