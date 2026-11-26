#!/usr/bin/env node
// Local web view for browsing a repository's project skills.
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AtlasError } from './core/errors.ts';
import { openGitHub, parseGitHubUrl, type Fetch } from './core/github.ts';
import { skillLink } from './core/model.ts';
import { scan } from './core/scan.ts';

const PAGE = fileURLToPath(new URL('../web/index.html', import.meta.url));

export type WebOptions = {
  fetch?: Fetch;
  token?: string;
};

/** Creates the localhost web view server. The fetch option makes the GitHub API replaceable in tests. */
export function createWebServer(options: WebOptions = {}): Server {
  const liveFetch = options.fetch ?? ((url, init) => fetch(url, init));

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' }).end();
      return;
    }

    if (url.pathname === '/') {
      try {
        const page = await readFile(PAGE);
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(page);
      } catch {
        response.writeHead(500).end('Could not read the web page');
      }
      return;
    }

    if (url.pathname !== '/api/scan') {
      response.writeHead(404).end('Not found');
      return;
    }

    const repositoryUrl = url.searchParams.get('url')?.trim() ?? '';
    if (!parseGitHubUrl(repositoryUrl)) {
      json(response, 400, { error: 'Enter a GitHub repository URL, optionally pinned to /tree/<commit>.' });
      return;
    }

    try {
      const result = await scan(await openGitHub(repositoryUrl, { fetch: liveFetch, token: options.token }));
      json(response, 200, {
        repository: result.repository,
        warnings: result.warnings,
        skills: result.skills.map((skill) => ({ ...skill, link: skillLink(result.repository, skill) })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(response, error instanceof AtlasError ? 422 : 500, { error: message });
    }
  });
}

function json(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }).end(JSON.stringify(body));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be between 0 and 65535');
  const server = createWebServer({ token: process.env.GITHUB_TOKEN || undefined });
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`Skill Atlas web view: http://127.0.0.1:${actualPort}`);
  });
}
