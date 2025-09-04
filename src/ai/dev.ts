import { config } from 'dotenv';
config();

// Import all AI flows to ensure they're loaded
import '@/ai/flows/generate-architecture.ts';
import '@/ai/flows/generate-tasks.ts';
import '@/ai/flows/generate-file-structure.ts';
import '@/ai/flows/research-task.ts';
import '@/ai/flows/generate-agents-md.ts';

// Initialize LiteLLM provider
import '@/ai/litellm.ts';

console.log('LiteLLM AI flows loaded successfully');
