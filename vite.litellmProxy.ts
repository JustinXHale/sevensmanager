import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const PROXY_PREFIX = '/sevensmanager/api/litellm';

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleProxy(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
  const url = req.url ?? '';
  if (!url.startsWith(PROXY_PREFIX)) {
    next();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Method not allowed');
    return;
  }

  const targetBase = req.headers['x-litellm-base-url'];
  if (!targetBase || Array.isArray(targetBase)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Missing X-LiteLLM-Base-Url header');
    return;
  }

  const suffix = url.slice(PROXY_PREFIX.length);
  const target = `${String(targetBase).replace(/\/+$/, '')}${suffix}`;

  try {
    const body = await readBody(req);
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': (req.headers['content-type'] as string) ?? 'application/json',
        Authorization: (req.headers.authorization as string) ?? '',
      },
      body,
    });

    res.statusCode = upstream.status;
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain');
    res.end(err instanceof Error ? err.message : 'LiteLLM proxy error');
  }
}

/** Dev/preview proxy so browser calls stay same-origin (avoids CORS on LiteLLM). */
export function liteLlmDevProxy(): Plugin {
  const attach = (middlewares: { use: (fn: typeof handleProxy) => void }) => {
    middlewares.use(handleProxy);
  };
  return {
    name: 'litellm-dev-proxy',
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
