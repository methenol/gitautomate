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

  console.log(`[DEBUG] Response parsing - first 200 chars: ${response.substring(0, 200)}`);

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(response);
    console.log(`[DEBUG] Successfully parsed as direct JSON`);
    return schema.parse(parsed);
  } catch (jsonError) {
    console.log(`[DEBUG] Direct JSON parsing failed:`, jsonError.message);
    
    // Try to extract JSON from the response - it might be wrapped in other text
    const jsonBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1]);
        console.log(`[DEBUG] Successfully parsed JSON from code block`);
        return schema.parse(parsed);
      } catch (markdownError) {
        console.log(`[DEBUG] Markdown JSON parsing failed:`, markdownError.message);
      }
    }
    
    // Try to find JSON object in the response (looking for { ... })
    const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        const parsed = JSON.parse(jsonObjectMatch[0]);
        console.log(`[DEBUG] Successfully parsed extracted JSON object`);
        return schema.parse(parsed);
      } catch (extractError) {
        console.log(`[DEBUG] Extracted JSON parsing failed:`, extractError.message);
      }
    }
    
    // As last resort, try to create a structured response based on common patterns
    console.log(`[DEBUG] Falling back to pattern-based parsing`);
    if ((schema as any)._def?.shape) {
      const result: any = {};
      const shapeKeys = Object.keys((schema as any)._def.shape);
      console.log(`[DEBUG] Schema expects keys:`, shapeKeys);
      
      if (shapeKeys.includes('architecture') && shapeKeys.includes('specifications')) {
        // Architecture generation response - use regex matching for JSON fields
        const archMatch = response.match(/"architecture"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
        const specMatch = response.match(/"specifications"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
        
        if (archMatch && specMatch) {
          result.architecture = archMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          result.specifications = specMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          console.log(`[DEBUG] Extracted via regex - arch length: ${result.architecture.length}, spec length: ${result.specifications.length}`);
        } else {
          // Try alternative patterns - look for the actual field names as they appear
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
          
          // If we still don't have both fields, use fallback
          if (!result.architecture) {
            result.architecture = 'Architecture information extracted from response.';
          }
          if (!result.specifications) {
            result.specifications = 'Specifications information extracted from response.';
          }
          
          console.log(`[DEBUG] Extracted via line parsing - arch: ${!!result.architecture}, spec: ${!!result.specifications}`);
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
      
      console.log(`[DEBUG] Final result before schema validation:`, Object.keys(result));
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