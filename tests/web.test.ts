import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createWebServer } from '../src/web.ts';
import { replay } from '../src/core/replay.ts';

const commit = '5ab6270ab772d113e8ad52ebfcaa0109c522ae00';
const skillPath = '.claude/skills/commits/SKILL.md';
const markdown = '---\nname: commits\ndescription: Write commit messages.\n---\n# Commits\n\nFollow these rules.\n';
const github = replay({
  'https://api.github.com/repos/JetBrains/example': { status: 200, body: { full_name: 'JetBrains/example', default_branch: 'main' } },
  'https://api.github.com/repos/JetBrains/example/commits/main': { status: 200, body: { sha: commit } },
  'https://api.github.com/search/code?q=filename:SKILL.md+repo:JetBrains/example&per_page=100&page=1': {
    status: 200,
    body: { total_count: 1, items: [{ path: skillPath }] },
  },
  [`https://raw.githubusercontent.com/JetBrains/example/${commit}/${skillPath}`]: { status: 200, body: markdown },
});

test('local web view serves the page and scans a repository into skills with SKILL.md content', async (t) => {
  const server = createWebServer({ fetch: github, token: 'test' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /GitHub repository URL/);
  assert.match(await (await fetch(`${base}/api/scan?url=${encodeURIComponent('github.com/JetBrains/example')}`)).text(), /SKILL.md/);

  const invalid = await fetch(`${base}/api/scan?url=${encodeURIComponent('https://example.com/not-a-repository')}`);
  assert.equal(invalid.status, 400);
  const invalidBody = await invalid.json() as { error: string };
  assert.match(invalidBody.error, /GitHub repository URL/);

  const response = await fetch(`${base}/api/scan?url=${encodeURIComponent('https://github.com/JetBrains/example')}`);
  assert.equal(response.status, 200);
  const result = await response.json() as {
    repository: { id: string };
    skills: { path: string; content: string; link: string }[];
  };
  assert.equal(result.repository.id, 'JetBrains/example');
  assert.equal(result.skills.length, 1);
  assert.equal(result.skills[0].path, skillPath);
  assert.equal(result.skills[0].content, markdown);
  assert.equal(result.skills[0].link, `https://github.com/JetBrains/example/blob/${commit}/${skillPath}`);
});
