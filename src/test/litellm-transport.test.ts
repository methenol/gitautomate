/**
 * Transport behaviour for slow local models.
 *
 * A local model can spend far longer than five minutes on a planning prompt. Node's
 * built-in fetch enforces undici's 300s `headersTimeout`/`bodyTimeout`, which killed such
 * requests with a bare `fetch failed` while the endpoint was still generating. These tests
 * pin the fix: no client-imposed deadline by default, and errors that name their cause.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const ORIGINAL_ENV = process.env.LLM_REQUEST_TIMEOUT_MS;

/** A server that stalls for `delayMs` before answering, like a model still prompt-processing. */
function startSlowServer(delayMs: number, body: unknown): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      }, delayMs);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}/v1` });
    });
  });
}

const completion = (content: string) => ({
  choices: [{ message: { content }, finish_reason: 'stop' }],
});

describe('litellm transport', () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.LLM_REQUEST_TIMEOUT_MS;
    } else {
      process.env.LLM_REQUEST_TIMEOUT_MS = ORIGINAL_ENV;
    }
    jest.resetModules();
  });

  /** Re-import per test so the timeout env var is read fresh. */
  async function loadAi() {
    jest.resetModules();
    return (await import('@/ai/litellm')).ai;
  }

  it('waits for a slow endpoint instead of imposing a deadline', async () => {
    const { server, url } = await startSlowServer(1_500, completion('# Architecture\n\nSlow but fine.'));
    try {
      const ai = await loadAi();
      const { output } = await ai.generate<string>({
        model: 'local-model',
        prompt: 'plan something',
        config: { apiKey: 'not-checked', apiBase: url },
      });

      expect(output).toContain('Slow but fine.');
    } finally {
      server.close();
    }
  });

  it('honours LLM_REQUEST_TIMEOUT_MS when it is set, and says so', async () => {
    process.env.LLM_REQUEST_TIMEOUT_MS = '150';
    const { server, url } = await startSlowServer(5_000, completion('too late'));
    try {
      const ai = await loadAi();
      await expect(
        ai.generate<string>({
          model: 'local-model',
          prompt: 'plan something',
          config: { apiKey: 'not-checked', apiBase: url },
        })
      ).rejects.toThrow(/aborted after [\s\S]*LLM_REQUEST_TIMEOUT_MS=150/);
    } finally {
      server.close();
    }
  });

  it('reports a refused connection with the endpoint and a Docker hint', async () => {
    // Claim a port, then release it, so the connection is refused rather than blocked by
    // the fetch spec's bad-port list.
    const { server, url } = await startSlowServer(0, completion('never served'));
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const ai = await loadAi();
    await expect(
      ai.generate<string>({
        model: 'local-model',
        prompt: 'plan something',
        config: { apiKey: 'not-checked', apiBase: url },
      })
    ).rejects.toThrow(/Nothing is listening at/);
  });

  it('accepts private and loopback endpoints, which is where local models live', async () => {
    const { server, url } = await startSlowServer(0, completion('ok'));
    try {
      const ai = await loadAi();
      // 127.0.0.1 was rejected outright whenever NODE_ENV was not "development".
      const previousEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
      try {
        const { output } = await ai.generate<string>({
          model: 'local-model',
          prompt: 'x',
          config: { apiKey: 'not-checked', apiBase: url },
        });
        expect(output).toBe('ok');
      } finally {
        Object.defineProperty(process.env, 'NODE_ENV', { value: previousEnv, configurable: true });
      }
    } finally {
      server.close();
    }
  });

  it('rejects a non-HTTP endpoint', async () => {
    const ai = await loadAi();
    await expect(
      ai.generate<string>({
        model: 'local-model',
        prompt: 'x',
        config: { apiKey: 'not-checked', apiBase: 'file:///etc/passwd' },
      })
    ).rejects.toThrow(/Only HTTP and HTTPS protocols are allowed/);
  });

  it('tolerates a trailing slash on the base URL', async () => {
    const { server, url } = await startSlowServer(0, completion('ok'));
    try {
      const ai = await loadAi();
      const { output } = await ai.generate<string>({
        model: 'local-model',
        prompt: 'x',
        config: { apiKey: 'not-checked', apiBase: `${url}/` },
      });
      expect(output).toBe('ok');
    } finally {
      server.close();
    }
  });

  it('explains a truncated completion rather than reporting an empty response', async () => {
    const { server, url } = await startSlowServer(0, {
      choices: [{ message: { content: '' }, finish_reason: 'length' }],
    });
    try {
      const ai = await loadAi();
      await expect(
        ai.generate<string>({
          model: 'local-model',
          prompt: 'x',
          config: { apiKey: 'not-checked', apiBase: url },
        })
      ).rejects.toThrow(/finish_reason: length/);
    } finally {
      server.close();
    }
  });

  it('passes temperature, max tokens and the system message to the endpoint', async () => {
    let received: Record<string, unknown> = {};
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        received = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(completion('ok')));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const ai = await loadAi();
      await ai.generate<string>({
        model: 'local-model',
        prompt: 'the user prompt',
        system: 'the system prompt',
        config: {
          apiKey: 'not-checked',
          apiBase: `http://127.0.0.1:${port}/v1`,
          temperature: 0.2,
          maxTokens: 4096,
        },
      });

      // Temperature used to be dropped on the floor here, pinning every call to 0.7.
      expect(received.temperature).toBe(0.2);
      expect(received.max_tokens).toBe(4096);
      expect(received.messages).toEqual([
        { role: 'system', content: 'the system prompt' },
        { role: 'user', content: 'the user prompt' },
      ]);
    } finally {
      server.close();
    }
  });
});
