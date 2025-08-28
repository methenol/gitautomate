/**
 * @fileOverview This file initializes the Genkit AI instance and provides functions for interacting with AI models.
 *
 * - ai: The global Genkit AI instance.
 * - listAvailableModels: A function to list available Gemini models.
 */
import { config } from 'dotenv';
config();

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Initialize Genkit with the Google AI plugin.
// This will use the GOOGLE_API_KEY from the .env file by default.
const ai = genkit({
  plugins: [googleAI()],
});

export {ai};

export async function listAvailableModels(apiKey?: string): Promise<string[]> {
  try {
    // Prioritize the key from settings, but fall back to the .env file.
    const key = apiKey || process.env.GOOGLE_API_KEY;

    // Only throw an error if NO key is available from either source.
    if (!key) {
      throw new Error(
        'Google AI API key not found. Please add it to your .env file or in the settings.'
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        error: {message: 'Failed to parse error response.'},
      }));
      console.error('Failed to fetch models from API:', errorBody);
      throw new Error(
        `Failed to fetch models. Status: ${response.status}. Please check your Google AI API key. The API returned: ${
          errorBody.error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();

    if (!data.models || !Array.isArray(data.models)) {
      console.log('API response did not contain a valid models array.');
      return [];
    }

    // Known deprecated or problematic models to filter out
    const deprecatedModels = [
      'gemini-2.5-flash-lite-preview-06-17', // Deprecated preview model
      'gemini-2.0-flash-lite-preview', // Preview models that may be unstable
    ];

    // Correctly parse the model list and remove the "models/" prefix.
    const allModels = data.models.map((model: {name: string}) =>
      model.name.replace('models/', '')
    );

    // Filter out deprecated/problematic models
    const validModels = allModels.filter((model: string) => 
      !deprecatedModels.some(deprecated => model.includes(deprecated))
    );

    // Always ensure we have fallback models available
    const fallbackModels = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-1.0-pro'
    ];

    // If we filtered out all models or got an empty list, return fallbacks
    if (validModels.length === 0) {
      console.warn('No valid models found from API, using fallback models');
      return fallbackModels;
    }

    // Ensure fallback models are included if they're not already present
    const modelsSet = new Set(validModels);
    for (const fallback of fallbackModels) {
      if (!modelsSet.has(fallback)) {
        validModels.push(fallback);
      }
    }

    return validModels;
  } catch (error) {
    console.error('Failed to fetch models directly:', error);
    
    // Return fallback models instead of throwing error
    const fallbackModels = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-1.0-pro'
    ];
    
    console.warn('Using fallback models due to API error');
    return fallbackModels;
  }
}
