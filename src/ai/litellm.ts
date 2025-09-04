import { z } from 'zod';

// LiteLLM settings interface as specified in the issue
interface LLMSettings {
  // User inputs provider/model in format "openai/gpt-4o" or "anthropic/claude-3"
  llmModel: string;        // Full provider/model identifier
  
  apiKey?: string;         // Optional API key (can use env vars)
  apiBase?: string;       // Custom endpoint URL for self-hosted
}

interface LLMConfig {
  settings: LLMSettings;
}

// Import LiteLLM completion function
// Note: We'll use dynamic import since LiteLLM is primarily a Python package
// For Node.js, we'll use a simplified wrapper approach
async function completion(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  api_key?: string;
  api_base?: string;
}) {
  // This is a simplified Node.js wrapper for LiteLLM
  // In a real implementation, this would interface with the LiteLLM Python service
  // or use a Node.js equivalent that provides the same abstraction
  
  const { model, messages, temperature = 0.7, max_tokens = 1000, api_key, api_base } = params;
  
  // LiteLLM auto-detects provider from model name
  // Examples: "gpt-4o" -> OpenAI, "claude-3-haiku" -> Anthropic, "gemini-pro" -> Google
  
  let apiUrl: string;
  let headers: Record<string, string>;
  let requestBody: any;
  
  // Auto-detect provider from model name (as LiteLLM does)
  if (model.includes('gpt-') || model.includes('o1-') || model.includes('text-')) {
    // OpenAI
    apiUrl = api_base || 'https://api.openai.com/v1/chat/completions';
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${api_key || process.env.OPENAI_API_KEY}`,
    };
    requestBody = {
      model,
      messages,
      temperature,
      max_tokens,
    };
  } else if (model.includes('claude-')) {
    // Anthropic
    apiUrl = api_base || 'https://api.anthropic.com/v1/messages';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': api_key || process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    };
    requestBody = {
      model,
      messages,
      max_tokens,
      temperature,
    };
  } else if (model.includes('gemini-')) {
    // Google AI
    const googleApiKey = api_key || process.env.GOOGLE_API_KEY;
    apiUrl = api_base || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey}`;
    headers = {
      'Content-Type': 'application/json',
    };
    // Convert messages to Google format
    const contents = messages.map(msg => ({
      parts: [{ text: msg.content }],
      role: msg.role === 'assistant' ? 'model' : 'user'
    }));
    requestBody = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: max_tokens,
      },
    };
  } else {
    throw new Error(`Unsupported model: ${model}`);
  }
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Normalize response format (LiteLLM provides OpenAI-compatible responses)
  if (model.includes('gemini-')) {
    // Convert Google response to OpenAI format
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        },
      }],
    };
  } else if (model.includes('claude-')) {
    // Convert Anthropic response to OpenAI format
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: data.content?.[0]?.text || '',
        },
      }],
    };
  } else {
    // OpenAI format (already correct)
    return data;
  }
}

// AI wrapper that replaces the genkit functionality
export const ai = {
  async generate(params: {
    model: string;
    prompt: string;
    output?: { schema: z.ZodSchema };
    config?: { apiKey?: string; apiBase?: string };
  }) {
    const { model, prompt, output, config } = params;
    
    const messages = [
      { role: 'user', content: prompt }
    ];
    
    // Add JSON schema instruction if output schema is provided
    let finalPrompt = prompt;
    if (output?.schema) {
      finalPrompt += '\n\nPlease respond with valid JSON that matches the required schema.';
    }
    
    const response = await completion({
      model,
      messages: [{ role: 'user', content: finalPrompt }],
      api_key: config?.apiKey,
      api_base: config?.apiBase,
    });
    
    const content = response.choices[0]?.message?.content || '';
    
    // If schema is provided, parse and validate JSON
    if (output?.schema) {
      try {
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        const parsed = JSON.parse(jsonString);
        const validated = output.schema.parse(parsed);
        return { output: validated };
      } catch (error) {
        throw new Error(`Failed to parse or validate JSON response: ${error}`);
      }
    }
    
    return { output: content };
  }
};