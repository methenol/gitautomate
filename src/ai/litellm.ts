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
  };
}

// Convert response to JSON format expected by the schema
function parseResponse(response: string, schema?: z.ZodSchema): any {
  if (!schema) {
    return response;
  }

  console.log(`[DEBUG] Response parsing - first 200 chars:`, response.substring(0, 200));

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(response);
    console.log(`[DEBUG] Direct JSON parsing successful`);
    return schema.parse(parsed);
  } catch (jsonError) {
    console.log(`[DEBUG] Direct JSON parsing failed:`, jsonError.message);
    
    // Detect if this is a fileStructure-only schema by testing what fields are required
    let shapeKeys: string[] = [];
    let isFileStructureSchema = false;
    
    try {
      // Method 1: Direct schema shape inspection
      if (schema && (schema as any)._def?.shape) {
        shapeKeys = Object.keys((schema as any)._def.shape);
        isFileStructureSchema = shapeKeys.includes('fileStructure') && shapeKeys.length === 1;
      }
      
      // Method 2: Test parsing to see what fields are required
      if (!isFileStructureSchema && schema) {
        const testParse = schema.safeParse({});
        if (!testParse.success && testParse.error?.issues) {
          const requiredFields = testParse.error.issues
            .filter(issue => issue.code === 'invalid_type' && issue.message === 'Required')
            .map(issue => issue.path[0])
            .filter(Boolean) as string[];
          
          shapeKeys = requiredFields;
          isFileStructureSchema = requiredFields.includes('fileStructure') && requiredFields.length === 1;
        }
      }
    } catch (e) {
      console.log(`[DEBUG] Schema introspection failed:`, e);
    }
    
    console.log(`[DEBUG] Detected schema keys:`, shapeKeys);
    console.log(`[DEBUG] Is fileStructure schema:`, isFileStructureSchema);
    
    // Check if response looks like a file structure (directory tree)
    const looksLikeFileStructureResponse = response.includes('```markdown') || 
                                          response.includes('project-root/') ||
                                          response.includes('├─') || 
                                          response.includes('└─') ||
                                          response.includes('│') ||
                                          response.includes('├') ||
                                          response.includes('└') ||
                                          response.includes('│') ||
                                          /^[a-zA-Z0-9-_]+\/\s*$/m.test(response);
    
    console.log(`[DEBUG] Looks like file structure response:`, looksLikeFileStructureResponse);
    
    // Handle fileStructure responses - if it's a fileStructure schema OR looks like a file structure
    if (isFileStructureSchema || looksLikeFileStructureResponse) {
      console.log(`[DEBUG] Processing fileStructure response`);
      
      let fileStructureContent = '';
      
      // Try to extract from markdown code blocks first - fix the regex to properly handle language identifiers
      const markdownBlockPatterns = [
        /```(?:markdown|text|bash|tree)\s*\n([\s\S]*?)\n?```/,  // Language specified
        /```\s*\n([\s\S]*?)\n?```/,  // No language specified
        /```([\s\S]*?)```/  // Simple fallback
      ];
      
      for (const pattern of markdownBlockPatterns) {
        const match = response.match(pattern);
        if (match) {
          console.log(`[DEBUG] Found markdown code block with pattern`);
          fileStructureContent = match[1].trim();
          // Remove any remaining language identifiers that might have been captured
          if (fileStructureContent.startsWith('markdown\n') || fileStructureContent.startsWith('text\n') || 
              fileStructureContent.startsWith('bash\n') || fileStructureContent.startsWith('tree\n')) {
            fileStructureContent = fileStructureContent.split('\n').slice(1).join('\n').trim();
          }
          break;
        }
      }
      
      // If no code block found, clean up any stray markdown markers and use the response directly
      if (!fileStructureContent) {
        console.log(`[DEBUG] No markdown code block found, cleaning response`);
        fileStructureContent = response
          .replace(/^```\w*\s*\n?/, '')  // Remove opening code block with optional language
          .replace(/\n?```$/, '')       // Remove closing code block  
          .trim();
      }
      
      console.log(`[DEBUG] Extracted fileStructure content (first 100 chars):`, fileStructureContent.substring(0, 100));
      
      if (fileStructureContent && fileStructureContent.length > 0) {
        console.log(`[DEBUG] Parsing fileStructure with schema`);
        return schema.parse({ fileStructure: fileStructureContent });
      } else {
        console.log(`[DEBUG] No fileStructure content found, using response as-is`);
        return schema.parse({ fileStructure: response.trim() });
      }
    }
    
    // Try to extract JSON from markdown code blocks - improved regex to handle various formats
    const jsonBlockMatches = [
      /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
      /```(?:json)?\s*([\s\S]*?)```/,
      /`{3,}(?:json)?\s*\n?([\s\S]*?)\n?`{3,}/
    ];
    
    for (const regex of jsonBlockMatches) {
      const match = response.match(regex);
      if (match) {
        try {
          const cleaned = match[1].trim();
          console.log(`[DEBUG] Markdown JSON parsing attempt:`, cleaned.substring(0, 100));
          const parsed = JSON.parse(cleaned);
          console.log(`[DEBUG] Markdown JSON parsing successful`);
          return schema.parse(parsed);
        } catch (markdownError) {
          console.log(`[DEBUG] Markdown JSON parsing failed:`, markdownError.message);
          continue; // Try next pattern
        }
      }
    }
    
    // Try to find JSON object with better boundary detection
    const jsonObjectMatches = [
      /\{[\s\S]*\}(?=\s*$|```|$)/,  // JSON that ends at string end or before ```
      /\{[^{]*"architecture"[\s\S]*?"specifications"[\s\S]*?\}/,  // More specific for our schema
      /\{[^{]*"fileStructure"[\s\S]*?\}/,  // Specific for file structure schema
      /\{[\s\S]*?\}(?=\s*\n\s*```|$)/,  // JSON that ends before closing ```
      /\{[\s\S]*\}/  // Fallback greedy match
    ];
    
    for (const regex of jsonObjectMatches) {
      const match = response.match(regex);
      if (match) {
        try {
          console.log(`[DEBUG] JSON object extraction attempt:`, match[0].substring(0, 100));
          const parsed = JSON.parse(match[0]);
          console.log(`[DEBUG] JSON object extraction successful`);
          return schema.parse(parsed);
        } catch (extractError) {
          console.log(`[DEBUG] JSON object extraction failed:`, extractError.message);
          continue; // Try next pattern
        }
      }
    }
    
    // As last resort, try to create a structured response based on common patterns
    if ((schema as any)._def?.shape) {
      const result: any = {};
      const shapeKeys = Object.keys((schema as any)._def.shape);
      console.log(`[DEBUG] Creating structured response for required keys:`, shapeKeys);
      
      if (shapeKeys.includes('architecture') && shapeKeys.includes('specifications')) {
        // Architecture generation response - use improved regex matching for JSON fields
        const regexPatterns = [
          [/"architecture"\s*:\s*"((?:[^"\\]|\\.)*)"/s, /"specifications"\s*:\s*"((?:[^"\\]|\\.)*)"/s],
          [/"architecture"\s*:\s*`([^`]*)`/s, /"specifications"\s*:\s*`([^`]*)`/s],
          [/architecture['"]\s*:\s*['"]([^'"]*)['"]/si, /specifications['"]\s*:\s*['"]([^'"]*)['"]/si]
        ];
        
        for (const [archPattern, specPattern] of regexPatterns) {
          const archMatch = response.match(archPattern);
          const specMatch = response.match(specPattern);
          
          if (archMatch && specMatch) {
            result.architecture = archMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
            result.specifications = specMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
            break;
          }
        }
        
        // If regex patterns fail, try line-by-line parsing
        if (!result.architecture || !result.specifications) {
          const lines = response.split('\n');
          let currentField = '';
          let currentContent = '';
          
          for (const line of lines) {
            if (line.includes('"architecture"') || line.toLowerCase().includes('architecture')) {
              if (currentField && currentContent) {
                result[currentField] = currentContent.trim();
              }
              currentField = 'architecture';
              currentContent = '';
            } else if (line.includes('"specifications"') || line.toLowerCase().includes('specifications')) {
              if (currentField && currentContent) {
                result[currentField] = currentContent.trim();
              }
              currentField = 'specifications';
              currentContent = '';
            } else if (currentField) {
              currentContent += line + '\n';
            }
          }
          
          // Add the last field
          if (currentField && currentContent) {
            result[currentField] = currentContent.trim();
          }
        }
        
        // Final fallback if we still don't have both fields
        if (!result.architecture) {
          result.architecture = 'Architecture information extracted from response.';
        }
        if (!result.specifications) {
          result.specifications = 'Specifications information extracted from response.';
        }
      } else if (shapeKeys.includes('fileStructure')) {
        // File structure generation response - this should have been handled above already
        console.log(`[DEBUG] WARNING: fileStructure processing reached fallback section - this should not happen`);
        result.fileStructure = response.trim() || 'Unable to extract file structure from response.';
      } else if (shapeKeys.includes('tasks')) {
        // Task generation response - try to extract task list
        const lines = response.split('\n').filter(line => line.trim());
        const tasks = lines
          .filter(line => line.match(/^\d+\.|^-|\*|^Task/i))
          .map(line => ({
            title: line.replace(/^\d+\.\s*|^[-*]\s*|^Task\s*\d*:?\s*/i, '').trim(),
            details: ''
          }));
        
        result.tasks = tasks.length > 0 ? tasks : [{ title: response.substring(0, 100), details: '' }];
      } else {
        // Generic response - use the first shape key as the response field
        const firstKey = shapeKeys[0];
        console.log(`[DEBUG] Using generic parsing with key:`, firstKey);
        result[firstKey] = response;
      }
      
      console.log(`[DEBUG] Final structured result before validation:`, Object.keys(result).reduce((acc, key) => {
        acc[key] = typeof result[key] === 'string' ? result[key].substring(0, 100) + '...' : result[key];
        return acc;
      }, {} as any));
      
      return schema.parse(result);
    }
    
    // If all else fails, return the raw response
    throw new Error(`Failed to parse response into expected schema: ${response.substring(0, 200)}...`);
  }
}



// Make OpenAI-compatible API call (works for all providers using OpenAI-compatible format)
async function makeOpenAICall(
  model: string,
  prompt: string,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const fullUrl = `${baseUrl}/chat/completions`;
  
  console.log(`Making API call to: ${fullUrl} with model: ${model}`);
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
    throw new Error(`LLM API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// LiteLLM implementation
export const ai = {
  async generate<T>(options: GenerateOptions): Promise<{ output: T }> {
    const { model, prompt, output, config } = options;
    
    try {
      console.log(`Starting LiteLLM generation with model: ${model}, config:`, config);
      
      // Require API key and base URL to be provided in config
      const apiKey = config?.apiKey;
      const baseUrl = config?.apiBase;
      
      if (!apiKey) {
        throw new Error(`API key is required. Please provide it in settings.`);
      }
      
      if (!baseUrl) {
        throw new Error(`API base URL is required. Please provide it in settings.`);
      }
      
      console.log(`Using model: ${model}, baseUrl: ${baseUrl}`);
      
      // Use OpenAI-compatible API for all providers - let the user configure their endpoint correctly
      const responseText = await makeOpenAICall(model, prompt, apiKey, baseUrl);
      
      // Parse response according to schema
      const parsedOutput = parseResponse(responseText, output?.schema);
      
      return { output: parsedOutput as T };
      
    } catch (error) {
      console.error('LiteLLM generation error:', error);
      
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