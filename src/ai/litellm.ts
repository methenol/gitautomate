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

  console.log(`[DEBUG] Raw AI response received (first 500 chars): ${response.substring(0, 500)}...`);

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(response);
    console.log(`[DEBUG] Successfully parsed as direct JSON:`, parsed);
    return schema.parse(parsed);
  } catch (jsonError) {
    console.log(`[DEBUG] Direct JSON parsing failed, trying markdown extraction`);
    
    // If JSON parsing fails, try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        console.log(`[DEBUG] Successfully parsed JSON from markdown block:`, parsed);
        return schema.parse(parsed);
      } catch (markdownError) {
        console.log(`[DEBUG] Markdown JSON parsing failed, falling back to text parsing`);
        // Fall through to create structured response
      }
    }
    
    // As last resort, try to create a structured response based on common patterns
    if ((schema as any)._def.shape) {
      const result: any = {};
      const shapeKeys = Object.keys((schema as any)._def.shape);
      console.log(`[DEBUG] Creating structured response for required keys:`, shapeKeys);
      
      if (shapeKeys.includes('architecture') && shapeKeys.includes('specifications')) {
        // Architecture generation response - use regex matching
        const archMatch = response.match(/(?:architecture|Architecture)([\s\S]*?)(?:specification|Specification|$)/i);
        const specMatch = response.match(/(?:specification|Specification)([\s\S]*?)$/i);
        
        result.architecture = archMatch ? archMatch[1].trim() : response;
        result.specifications = specMatch ? specMatch[1].trim() : 'Please refer to the architecture above.';
        
        console.log(`[DEBUG] Extracted architecture length: ${result.architecture.length}, specifications length: ${result.specifications.length}`);
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
        console.log(`[DEBUG] Extracted ${result.tasks.length} tasks`);
      } else {
        // Generic response - use the first shape key as the response field
        const firstKey = shapeKeys[0];
        result[firstKey] = response;
        console.log(`[DEBUG] Using generic parsing with key: ${firstKey}`);
      }
      
      console.log(`[DEBUG] Final structured result before validation:`, result);
      return schema.parse(result);
    }
    
    // If all else fails, return the raw response
    console.error(`[DEBUG] All parsing methods failed for response: ${response.substring(0, 200)}...`);
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