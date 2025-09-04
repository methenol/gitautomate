/**
 * @fileOverview LiteLLM-style abstraction layer for multiple LLM providers
 * 
 * This file provides a unified interface for interacting with different LLM providers
 * including OpenAI, Anthropic, Google AI, and custom endpoints. It replaces the 
 * Genkit implementation with a provider-agnostic approach.
 */

import { config } from 'dotenv';
config();

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Provider-agnostic configuration interface
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

// Unified message format (OpenAI-compatible)
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Unified response format
interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Generate function parameters
interface GenerateParams {
  model: string;
  prompt: string;
  output?: {
    schema: z.ZodSchema;
  };
  config?: {
    apiKey?: string;
    baseUrl?: string;
  };
  temperature?: number;
  maxTokens?: number;
}

// Flow definition interface (compatible with existing Genkit flows)
interface FlowDefinition {
  name: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
}

class LiteLLMProvider {
  private getProviderFromModel(model: string): { provider: string; actualModel: string } {
    // Parse provider/model format or infer from model name
    if (model.includes('/')) {
      const [provider, actualModel] = model.split('/', 2);
      return { provider, actualModel };
    }
    
    // Infer provider from model name patterns
    if (model.startsWith('gpt-') || model.includes('gpt')) {
      return { provider: 'openai', actualModel: model };
    }
    if (model.startsWith('claude-') || model.includes('claude')) {
      return { provider: 'anthropic', actualModel: model };
    }
    if (model.startsWith('gemini-') || model.includes('gemini')) {
      return { provider: 'google', actualModel: model };
    }
    
    // Default to OpenAI format
    return { provider: 'openai', actualModel: model };
  }

  private async callOpenAI(
    model: string,
    messages: Message[],
    config?: { apiKey?: string; baseUrl?: string },
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const client = new OpenAI({
      apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config?.baseUrl,
    });

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4000,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      usage: response.usage ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  private async callAnthropic(
    model: string,
    messages: Message[],
    config?: { apiKey?: string; baseUrl?: string },
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const client = new Anthropic({
      apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config?.baseUrl,
    });

    // Convert messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4000,
      temperature: options?.temperature ?? 0.7,
      system: systemMessage?.content,
      messages: userMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const content = response.content[0];
    return {
      content: content.type === 'text' ? content.text : '',
      usage: response.usage ? {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      } : undefined,
    };
  }

  private async callGoogle(
    model: string,
    messages: Message[],
    config?: { apiKey?: string; baseUrl?: string },
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    // Use Google AI API directly (similar to current implementation)
    const apiKey = config?.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google AI API key not found');
    }

    const url = config?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/models';
    const endpoint = `${url}/${model}:generateContent?key=${apiKey}`;

    // Convert messages to Google AI format
    const prompt = messages.map(m => m.content).join('\n\n');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 4000,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Google AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content,
      usage: data.usageMetadata ? {
        prompt_tokens: data.usageMetadata.promptTokenCount || 0,
        completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
    };
  }

  async generate<TOutput>(params: GenerateParams): Promise<{ output: TOutput }> {
    const { model, prompt, output, config, temperature, maxTokens } = params;
    
    const { provider, actualModel } = this.getProviderFromModel(model);
    
    // Create messages array
    const messages: Message[] = [
      { role: 'user', content: prompt }
    ];

    let response: LLMResponse;

    try {
      switch (provider) {
        case 'openai':
          response = await this.callOpenAI(actualModel, messages, config, { temperature, maxTokens });
          break;
        case 'anthropic':
          response = await this.callAnthropic(actualModel, messages, config, { temperature, maxTokens });
          break;
        case 'google':
          response = await this.callGoogle(actualModel, messages, config, { temperature, maxTokens });
          break;
        default:
          // Treat custom as OpenAI-compatible
          response = await this.callOpenAI(actualModel, messages, config, { temperature, maxTokens });
          break;
      }
    } catch (error) {
      console.error(`Error calling ${provider} provider:`, error);
      throw new Error(`Failed to generate response from ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Parse response if schema is provided
    let parsedOutput = response.content;
    
    if (output?.schema) {
      try {
        // Try to parse as JSON first
        const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/) || 
                         response.content.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, response.content];
        
        const jsonContent = jsonMatch[1] || response.content;
        const parsed = JSON.parse(jsonContent.trim());
        
        // Validate against schema
        parsedOutput = output.schema.parse(parsed);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        console.error('Response content:', response.content);
        throw new Error(`Failed to parse structured response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
      }
    }

    return { output: parsedOutput as TOutput };
  }

  // Flow definition method (compatible with existing code)
  defineFlow<TInput, TOutput>(
    definition: FlowDefinition,
    handler: (input: TInput) => Promise<TOutput>
  ) {
    return handler;
  }
}

// Export singleton instance
export const ai = new LiteLLMProvider();

// Export types for use in flows
export type { GenerateParams };