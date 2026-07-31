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
  /** Optional system message, sent ahead of the prompt when supported. */
  system?: string;
  output?: {
    schema: z.ZodSchema;
  };
  config?: {
    apiKey?: string;
    apiBase?: string;
    timeout?: number; // Timeout in milliseconds
    temperature?: number; // Temperature for LLM calls (0.0 - 2.0)
    maxTokens?: number; // Completion budget; planning documents can be long
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
    
    // Detect what type of schema we're dealing with by testing required fields
    const result: any = {};
    let detectedFields: string[] = [];
    
    // Try to detect schema fields using safeParse with empty object
    try {
      const testResult = schema.safeParse({});
      if (!testResult.success) {
        detectedFields = testResult.error.issues
          .filter((issue: any) => issue.code === 'invalid_type' && issue.path.length === 1)
          .map((issue: any) => issue.path[0] as string);
      }
    } catch {
      // Fallback: try the old method
      if ((schema as any)._def?.shape) {
        detectedFields = Object.keys((schema as any)._def.shape);
      }
    }
    
    if (detectedFields.includes('architecture') && detectedFields.includes('specifications')) {
      // Architecture generation response
      const archMatch = response.match(/(?:architecture|Architecture)([\s\S]*?)(?:specification|Specification|$)/i);
      const specMatch = response.match(/(?:specification|Specification)([\s\S]*?)$/i);
      
      result.architecture = archMatch ? archMatch[1].trim() : response;
      result.specifications = specMatch ? specMatch[1].trim() : 'Please refer to the architecture above.';
    } else if (detectedFields.includes('tasks')) {
      // Task generation response - try to extract task list
      const lines = response.split('\n').filter(line => line.trim());
      const tasks = lines
        .filter(line => line.match(/^\d+\.|^-|\*|^Task/i))
        .map(line => ({
          title: line.replace(/^\d+\.\s*|^[-*]\s*|^Task\s*\d*:?\s*/i, '').trim(),
          details: ''
        }));
      
      result.tasks = tasks.length > 0 ? tasks : [{ title: response.substring(0, 100), details: '' }];
    } else if (detectedFields.includes('fileStructure')) {
      // File structure generation response - extract from markdown code blocks or direct tree
      let fileStructureContent = '';
      
      // Try to extract from markdown code blocks with common language identifiers
      const markdownMatch = response.match(/```(?:markdown|text|bash|tree)?\s*\n?([\s\S]*?)\n?```/);
      if (markdownMatch) {
        fileStructureContent = markdownMatch[1].trim();
      } else {
        // If no code block, look for tree-like structures directly in response
        const lines = response.split('\n');
        const treeLines = lines.filter(line => 
          line.includes('├') || line.includes('└') || line.includes('│') ||
          line.match(/^[a-zA-Z0-9-_.]+\/\s*$/) || 
          line.match(/^\s*[a-zA-Z0-9-_.]+\.(js|ts|tsx|jsx|py|html|css|md|json|yml|yaml)/)
        );
        
        if (treeLines.length > 0) {
          fileStructureContent = treeLines.join('\n');
        } else {
          // Fallback to using the entire response
          fileStructureContent = response.trim();
        }
      }
      
      result.fileStructure = fileStructureContent || 'Unable to extract file structure from response.';
    } else if (detectedFields.includes('context') && detectedFields.includes('implementationSteps') && detectedFields.includes('acceptanceCriteria')) {
      // Research task response - extract the three fields
      const contextMatch = response.match(/(?:context|Context)['":\s]*([\s\S]*?)(?:implementation|Implementation|acceptance|Acceptance|$)/i);
      const implementationMatch = response.match(/(?:implementation|Implementation)[^:]*[:\s]*([\s\S]*?)(?:acceptance|Acceptance|$)/i);
      const acceptanceMatch = response.match(/(?:acceptance|Acceptance)[^:]*[:\s]*([\s\S]*?)$/i);
      
      result.context = contextMatch ? contextMatch[1].trim() : 'Context information extracted from response.';
      result.implementationSteps = implementationMatch ? implementationMatch[1].trim() : 'Implementation steps extracted from response.';
      result.acceptanceCriteria = acceptanceMatch ? acceptanceMatch[1].trim() : 'Acceptance criteria extracted from response.';
    } else {
      // Generic response - use the first detected field as the response field
      const firstKey = detectedFields[0];
      if (firstKey) {
        result[firstKey] = response;
      } else {
        throw new Error(`Unable to determine schema structure for response: ${response.substring(0, 200)}...`);
      }
    }
    
    return schema.parse(result);
  }
}



/**
 * Validate the user-supplied endpoint.
 *
 * The base URL is entered by the operator of this local tool, so private and loopback
 * addresses are allowed on purpose: LM Studio, Ollama, llama.cpp and vLLM all live on
 * localhost or the LAN, and the previous blanket rejection of `10.*`, `172.*`,
 * `192.168.*` and `localhost` outside development broke exactly that use case whenever
 * the app ran in Docker (where NODE_ENV is production).
 */
function validateAndSanitizeUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);

    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only HTTP and HTTPS protocols are allowed');
    }

    return baseUrl; // Preserve full URL including path
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }
    throw new Error('Invalid URL format');
  }
}

/**
 * Request timeout in milliseconds. `0` disables it, which is the default: a local model
 * on modest hardware can spend well over an hour on a long planning prompt, and there is
 * nothing useful to do with a half-generated document. Set `LLM_REQUEST_TIMEOUT_MS` to a
 * positive number to impose one.
 */
function configuredTimeoutMs(): number {
  const raw = process.env.LLM_REQUEST_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === '') return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * HTTP transport with the socket-level timeouts switched off.
 *
 * This is the fix for requests that died with a bare `fetch failed` while the model was
 * still working: Node's built-in fetch enforces undici's `headersTimeout` and
 * `bodyTimeout`, both 300s by default, and a local model that takes longer than five
 * minutes to produce its first byte trips `UND_ERR_HEADERS_TIMEOUT` regardless of any
 * AbortController we set. `0` disables each of them; the connect timeout stays short so a
 * genuinely wrong URL still fails quickly.
 */
type FetchImpl = (url: string, init: Record<string, unknown>) => Promise<Response>;

let transportPromise: Promise<{ fetchImpl: FetchImpl; dispatcher?: unknown }> | null = null;

function getTransport(): Promise<{ fetchImpl: FetchImpl; dispatcher?: unknown }> {
  if (!transportPromise) {
    transportPromise = (async () => {
      try {
        const undici = await import('undici');
        const dispatcher = new undici.Agent({
          headersTimeout: 0,
          bodyTimeout: 0,
          keepAliveTimeout: 60_000,
          connect: { timeout: 30_000 },
        });
        return {
          fetchImpl: undici.fetch as unknown as FetchImpl,
          dispatcher,
        };
      } catch (error) {
        // Global fetch still works; it just re-imposes the 300s header timeout.
        console.warn(
          'undici unavailable, falling back to global fetch. Requests to slow local models may fail after ~5 minutes.',
          error instanceof Error ? error.message : String(error)
        );
        return { fetchImpl: globalThis.fetch as unknown as FetchImpl };
      }
    })();
  }
  return transportPromise;
}

type ErrorLike = { message?: unknown; code?: unknown; cause?: unknown; errors?: unknown };

/**
 * Unwrap the chain of `cause`s so "fetch failed" reports what actually failed.
 *
 * Duck-typed rather than `instanceof Error`: the interesting layers are constructed by
 * Node's internals, and `instanceof` fails across realms — under Jest that silently
 * truncated the chain to the useless outer "fetch failed".
 */
function describeFetchError(error: unknown, depth = 0): string {
  if (depth > 5 || error === null || typeof error !== 'object') {
    return String(error);
  }

  const candidate = error as ErrorLike;
  const message = typeof candidate.message === 'string' ? candidate.message : String(error);
  const code = typeof candidate.code === 'string' ? ` (${candidate.code})` : '';
  const parts = [`${message}${code}`];

  if (candidate.cause !== undefined && candidate.cause !== null) {
    parts.push(describeFetchError(candidate.cause, depth + 1));
  } else if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
    // AggregateError: happens when a host resolves to several addresses and all fail.
    parts.push(candidate.errors.map((nested) => describeFetchError(nested, depth + 1)).join(', '));
  }

  return parts.join(' ← ');
}

// Make OpenAI-compatible API call (works for all providers using OpenAI-compatible format)
async function makeOpenAICall(
  model: string,
  prompt: string,
  apiKey: string,
  baseUrl: string,
  timeout: number = configuredTimeoutMs(),
  temperature?: number,
  system?: string,
  maxTokens: number = 32768
): Promise<string> {
  const validatedBaseUrl = validateAndSanitizeUrl(baseUrl);
  const fullUrl = `${validatedBaseUrl.replace(/\/+$/, '')}/chat/completions`;
  const { fetchImpl, dispatcher } = await getTransport();

  console.log(
    'Making API call to:', fullUrl,
    'with model:', model,
    timeout > 0 ? `(timeout ${timeout}ms)` : '(no timeout)'
  );

  const controller = new AbortController();
  const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : undefined;
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(fullUrl, {
      ...(dispatcher ? { dispatcher } : {}),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
      throw new Error(
        `LLM API error (HTTP ${response.status}): ${
          (errorData as { error?: { message?: string } }).error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.length === 0) {
      // A finish_reason of `length` here means max_tokens truncated the document; saying so
      // is far more useful than the generic "unexpected response" the caller would report.
      const finishReason = data.choices?.[0]?.finish_reason;
      throw new Error(
        `The model returned no content${finishReason ? ` (finish_reason: ${finishReason})` : ''}.`
      );
    }

    console.log(`Received ${content.length} characters in ${Math.round((Date.now() - startedAt) / 1000)}s`);
    return content;
  } catch (error) {
    clearTimeout(timeoutId);

    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    // Ask the signal, not the error: the abort surfaces with a different name and message
    // depending on which fetch implementation is in play.
    if (controller.signal.aborted) {
      throw new Error(
        `Request aborted after ${elapsedSeconds}s (LLM_REQUEST_TIMEOUT_MS=${timeout}). ` +
          'Unset LLM_REQUEST_TIMEOUT_MS to wait indefinitely for slow local models.'
      );
    }

    // `fetch failed` on its own is undiagnosable; the cause chain names the real fault.
    if (error instanceof Error && error.message === 'fetch failed') {
      throw new Error(`Request to ${fullUrl} failed after ${elapsedSeconds}s: ${describeFetchError(error)}`);
    }

    throw error;
  }
}

// LiteLLM implementation
export const ai = {
  async generate<T>(options: GenerateOptions): Promise<{ output: T }> {
    const { model, prompt, system, output, config } = options;
    
    try {
      // Sanitize config before logging to avoid exposing sensitive information
      const { apiKey: userApiKey, ...safeConfig } = config || {};
      console.log('Starting LiteLLM generation with model:', model, 'config:', safeConfig);
      
      // Require API key and base URL to be provided in config
      const apiKey = userApiKey;
      const baseUrl = config?.apiBase;
      
      if (!apiKey) {
        throw new Error(`API key is required. Please provide it in settings.`);
      }
      
      if (!baseUrl) {
        throw new Error(`API base URL is required. Please provide it in settings.`);
      }
      
      console.log('Using model:', model, 'baseUrl:', baseUrl);
      
      // Use OpenAI-compatible API for all providers - let the user configure their endpoint correctly
      const responseText = await makeOpenAICall(
        model,
        prompt,
        apiKey,
        baseUrl,
        config?.timeout,
        config?.temperature,
        system,
        config?.maxTokens
      );
      
      // Parse response according to schema
      const parsedOutput = parseResponse(responseText, output?.schema);
      
      return { output: parsedOutput as T };
      
    } catch (error) {
      // Classify on the whole cause chain, not the outer message: transport failures
      // surface as a bare "fetch failed" whose `cause` holds the only useful detail
      // (UND_ERR_HEADERS_TIMEOUT, ECONNREFUSED, ENOTFOUND…).
      const detail = describeFetchError(error);
      console.error('LiteLLM generation error:', detail);

      if (detail.includes('API key')) {
        throw new Error(`LLM API Error: ${detail}`);
      }
      if (detail.includes('HEADERS_TIMEOUT') || detail.includes('BODY_TIMEOUT')) {
        throw new Error(
          `The HTTP client closed the connection to ${config?.apiBase} before the model responded. ` +
            'This is a transport timeout, not the model refusing. Retry, and if it persists check that no proxy ' +
            `in front of the endpoint is cutting idle connections. Detail: ${detail}`
        );
      }
      if (detail.includes('ECONNREFUSED')) {
        throw new Error(
          `Nothing is listening at ${config?.apiBase}. Check the endpoint is running and reachable from here ` +
            '(inside Docker, "localhost" is the container itself — use the host IP or host.docker.internal).'
        );
      }
      if (detail.includes('ENOTFOUND') || detail.includes('getaddrinfo') || detail.includes('EAI_AGAIN')) {
        throw new Error(`The host in ${config?.apiBase} could not be resolved. Detail: ${detail}`);
      }
      if (detail.includes('ECONNRESET') || detail.includes('EPIPE') || detail.includes('UND_ERR_SOCKET')) {
        throw new Error(
          `The connection to ${config?.apiBase} was reset before the response completed. ` +
            `If the model was still generating, the endpoint or a proxy dropped it. Detail: ${detail}`
        );
      }
      if (detail.includes('404') || /model .*not found/i.test(detail)) {
        throw new Error(
          `Model '${model}' not found at ${config?.apiBase}. Check the model name matches what the endpoint serves.`
        );
      }
      if (detail.includes('unauthorized') || detail.includes('401')) {
        throw new Error(`Authentication failed. Please check your API key.`);
      }
      if (detail.includes('parse')) {
        throw new Error(`The model returned an unexpected response format. Try a different model or adjust your prompt.`);
      }
      if (detail.includes('fetch failed')) {
        throw new Error(`Request to ${config?.apiBase} failed: ${detail}`);
      }

      throw error;
    }
  }
};