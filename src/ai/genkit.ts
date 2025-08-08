/**
 * @fileOverview This file initializes the Genkit AI instance and provides functions for interacting with AI models.
 *
 * - ai: The global Genkit AI instance.
 * - listAvailableModels: A function to list available Gemini models.
 */
import { config } from 'dotenv';
config();

// IMPORTANT: Removed global ai instance creation to prevent "Cannot define new actions at runtime" errors
// Individual flows should use direct ai.generate() calls with proper model configurations instead of importing a global instance
// This prevents Genkit flow registry conflicts during runtime

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

    // Correctly parse the model list and remove the "models/" prefix.
    return data.models.map((model: {name: string}) =>
      model.name.replace('models/', '')
    );
  } catch (error) {
    console.error('Failed to fetch models directly:', error);
    // Let the UI know an error occurred.
    // The error is likely an invalid API key or network issue.
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching models.');
  }
}
