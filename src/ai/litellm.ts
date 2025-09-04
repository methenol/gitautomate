/**
 * @fileOverview LiteLLM abstraction layer providing provider-agnostic LLM integration
 * 
 * This module replaces Genkit with LiteLLM to support multiple LLM providers through
 * a unified OpenAI-compatible API interface.
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

// Default base URLs for known providers
const DEFAULT_BASE_URLS: Record<string, string> = {
  'openai': 'https://api.openai.com/v1',
  'anthropic': 'https://api.anthropic.com',
  'gemini': 'https://generativelanguage.googleapis.com/v1beta',
};

// Get API key from environment variables based on provider
function getEnvironmentApiKey(provider: string): string | undefined {
  const envKeys: Record<string, string> = {
    'openai': 'OPENAI_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY', 
    'gemini': 'GOOGLE_API_KEY',
    'google': 'GOOGLE_API_KEY',
  };
  
  const envKey = envKeys[provider.toLowerCase()];
  return envKey ? process.env[envKey] : undefined;
}

// Parse provider/model string (e.g., "openai/gpt-4o" -> {provider: "openai", model: "gpt-4o"})
function parseModelString(modelString: string): { provider: string; model: string } {
  if (modelString.includes('/')) {
    const [provider, ...modelParts] = modelString.split('/');
    return { provider, model: modelParts.join('/') };
  }
  
  // Handle single model names (assume they are standalone models)
  if (modelString.startsWith('gpt-') || modelString.startsWith('o1-')) {
    return { provider: 'openai', model: modelString };
  }
  if (modelString.startsWith('claude-')) {
    return { provider: 'anthropic', model: modelString };
  }
  if (modelString.includes('gemini') || modelString.includes('palm')) {
    return { provider: 'gemini', model: modelString };
  }
  
  // Default to treating it as a standalone model name
  return { provider: '', model: modelString };
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
    
    // As last resort, try to create a structured response based on common patterns
    if ((schema as any)._def.shape) {
      const result: any = {};
      const shapeKeys = Object.keys((schema as any)._def.shape);
      
      if (shapeKeys.includes('architecture') && shapeKeys.includes('specifications')) {
        // Architecture generation response
        const archMatch = response.match(/(?:architecture|Architecture)([\s\S]*?)(?:specification|Specification|$)/i);
        const specMatch = response.match(/(?:specification|Specification)([\s\S]*?)$/i);
        
        result.architecture = archMatch ? archMatch[1].trim() : response;
        result.specifications = specMatch ? specMatch[1].trim() : 'Please refer to the architecture above.';
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

// Make OpenAI-compatible API call
async function makeOpenAICall(
  model: string,
  prompt: string,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
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
    throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// Make Anthropic API call
async function makeAnthropicCall(
  model: string,
  prompt: string,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
    throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

// Make Google Gemini API call
async function makeGeminiCall(
  model: string,
  prompt: string,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
    throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text || '';
}

// LiteLLM implementation
export const ai = {
  async generate<T>(options: GenerateOptions): Promise<{ output: T }> {
    const { model, prompt, output, config } = options;
    
    try {
      const { provider, model: modelName } = parseModelString(model);
      
      // Get API key - prioritize config, then environment variables
      let apiKey = config?.apiKey;
      if (!apiKey && provider) {
        apiKey = getEnvironmentApiKey(provider);
      }
      
      if (!apiKey) {
        throw new Error(`API key not found for provider "${provider}". Please provide it in settings or set the appropriate environment variable.`);
      }
      
      // Get base URL - prioritize config, then defaults
      let baseUrl = config?.apiBase;
      if (!baseUrl && provider && DEFAULT_BASE_URLS[provider]) {
        baseUrl = DEFAULT_BASE_URLS[provider];
      }
      
      if (!baseUrl) {
        // If no base URL found, assume OpenAI-compatible endpoint
        baseUrl = config?.apiBase || 'https://api.openai.com/v1';
      }
      
      let responseText: string;
      
      // Make API call based on provider
      if (provider === 'anthropic' && baseUrl.includes('anthropic.com')) {
        responseText = await makeAnthropicCall(modelName, prompt, apiKey, baseUrl.replace('/v1', ''));
      } else if (provider === 'gemini' && baseUrl.includes('googleapis.com')) {
        responseText = await makeGeminiCall(modelName, prompt, apiKey, baseUrl);
      } else {
        // Default to OpenAI-compatible API (covers OpenAI, LM Studio, and most local providers)
        responseText = await makeOpenAICall(modelName, prompt, apiKey, baseUrl);
      }
      
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
          throw new Error(`Authentication failed. Please check your API key for provider.`);
        }
        if (error.message.includes('parse')) {
          throw new Error(`The model returned an unexpected response format. Try a different model or adjust your prompt.`);
        }
      }
      
      throw error;
    }
  }
};