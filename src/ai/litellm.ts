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

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(response);
    return schema.parse(parsed);
  } catch (jsonError) {
    
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
          const parsed = JSON.parse(cleaned);
          return schema.parse(parsed);
        } catch (markdownError) {
          continue; // Try next pattern
        }
      }
    }
    
    // Try to find JSON object with better boundary detection
    const jsonObjectMatches = [
      /\{[\s\S]*\}(?=\s*$|```|$)/,  // JSON that ends at string end or before ```
      /\{[^{]*"architecture"[\s\S]*?"specifications"[\s\S]*?\}/,  // More specific for our schema
      /\{[\s\S]*?\}(?=\s*\n\s*```|$)/,  // JSON that ends before closing ```
      /\{[\s\S]*\}/  // Fallback greedy match
    ];
    
    for (const regex of jsonObjectMatches) {
      const match = response.match(regex);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          return schema.parse(parsed);
        } catch (extractError) {
          continue; // Try next pattern
        }
      }
    }
    
    // As last resort, try to create a structured response based on common patterns
    if ((schema as any)._def?.shape) {
      const result: any = {};
      const shapeKeys = Object.keys((schema as any)._def.shape);
      
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
        // File structure generation response - extract the file structure content
        const fileStructurePatterns = [
          /"fileStructure"\s*:\s*"((?:[^"\\]|\\.)*)"/s,
          /"fileStructure"\s*:\s*`([^`]*)`/s,
          /fileStructure['"]\s*:\s*['"]([^'"]*)['"]/si,
          /```[\s\S]*?```/g, // Extract code blocks as potential file structure
          /^\s*[\w-]+\/?\s*$/m // Look for directory/file patterns
        ];
        
        // Try regex patterns first
        for (const pattern of fileStructurePatterns.slice(0, 3)) {
          const match = response.match(pattern);
          if (match) {
            result.fileStructure = match[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\t/g, '\t');
            break;
          }
        }
        
        // If no specific field match, look for code blocks or tree structures
        if (!result.fileStructure) {
          const codeBlockMatch = response.match(/```[\s\S]*?```/);
          if (codeBlockMatch) {
            result.fileStructure = codeBlockMatch[0]
              .replace(/^```[a-zA-Z]*\s*/, '')
              .replace(/```$/, '')
              .trim();
          } else {
            // Look for tree-like structures in the response
            const lines = response.split('\n');
            const treeLines = lines.filter(line => 
              line.match(/^\s*[\w.-]+\/?\s*$/) || 
              line.match(/^\s*[├└│]\s*[\w.-]+/) ||
              line.match(/^\s*[\w.-]+\/$/) ||
              line.includes('  ') && line.match(/[\w.-]+\.(js|ts|json|md|css|html|py|java|cpp|go|rs)$/)
            );
            
            if (treeLines.length > 0) {
              result.fileStructure = treeLines.join('\n');
            } else {
              // Fallback - use the entire response as file structure
              result.fileStructure = response.trim();
            }
          }
        }
        
        // Ensure we have some content
        if (!result.fileStructure || result.fileStructure.trim().length === 0) {
          result.fileStructure = 'File structure information extracted from response.';
        }
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
        result[firstKey] = response;
      }
      
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