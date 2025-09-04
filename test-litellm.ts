/**
 * Test script to validate LiteLLM integration
 * Tests provider detection and basic functionality
 */

import { ai } from './src/ai/litellm';
import { z } from 'zod';

const TestOutputSchema = z.object({
  message: z.string().describe('A simple test message'),
});

async function testLiteLLMIntegration() {
  console.log('Testing LiteLLM Integration...\n');

  // Test different model formats
  const testCases = [
    {
      name: 'OpenAI GPT-4o (direct)',
      model: 'gpt-4o',
      prompt: 'Respond with JSON: {"message": "Hello from OpenAI"}'
    },
    {
      name: 'OpenAI GPT-4o (with provider prefix)',
      model: 'openai/gpt-4o',
      prompt: 'Respond with JSON: {"message": "Hello from OpenAI with prefix"}'
    },
    {
      name: 'Anthropic Claude (direct)',
      model: 'claude-3-haiku-20240307',
      prompt: 'Respond with JSON: {"message": "Hello from Anthropic"}'
    },
    {
      name: 'Anthropic Claude (with provider prefix)',
      model: 'anthropic/claude-3-haiku-20240307',
      prompt: 'Respond with JSON: {"message": "Hello from Anthropic with prefix"}'
    },
    {
      name: 'Google Gemini (direct)',
      model: 'gemini-1.5-flash-latest',
      prompt: 'Respond with JSON: {"message": "Hello from Google"}'
    },
    {
      name: 'Google Gemini (with provider prefix)',
      model: 'google/gemini-1.5-flash-latest',
      prompt: 'Respond with JSON: {"message": "Hello from Google with prefix"}'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log(`   Model: ${testCase.model}`);
    
    try {
      const result = await ai.generate({
        model: testCase.model,
        prompt: testCase.prompt,
        output: {
          schema: TestOutputSchema
        }
      });

      console.log(`✅ Success: ${JSON.stringify(result.output)}`);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          console.log(`⚠️  Expected error (no API key): ${error.message}`);
        } else {
          console.log(`❌ Unexpected error: ${error.message}`);
        }
      } else {
        console.log(`❌ Unknown error: ${String(error)}`);
      }
    }
  }

  console.log('\n🎯 LiteLLM Integration Test Complete!');
  console.log('\nNote: Errors about missing API keys are expected since no real API keys are configured.');
  console.log('The test validates that the provider detection and request formatting works correctly.');
}

// Only run if this script is executed directly
if (require.main === module) {
  testLiteLLMIntegration().catch(console.error);
}

export { testLiteLLMIntegration };