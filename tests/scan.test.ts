// The decisions in spec/analysis.md and spec/cli.md, checked on what the real command prints for
// ./fixture and for small GitHub repositories answered in tests/helpers.ts and below.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { openGitHub } from '../src/core/github.ts';
import { parseSkill } from '../src/core/parse.ts';
import { replay } from '../src/core/replay.ts';
import { atlas, CLI, EXAMPLE_COMMIT, FIXTURE } from './helpers.ts';

const fixture = await atlas(['scan', FIXTURE]);
const example = await atlas(['scan', 'github.com/JetBrains/example']);
const root = pathToFileURL(FIXTURE).href;

test('malformed front matter → the directory name, no description and a warning', () => {
  const parsed = parseSkill(readFileSync(join(FIXTURE, '.agents/skills/release-checklist/SKILL.md'), 'utf8'));
  assert.equal(parsed.name, undefined);
  assert.equal(parsed.description, '');
  assert.equal(
    parsed.warning,
    'malformed front matter: Nested mappings are not allowed in compact mappings at line 3, column 14; using the directory name',
  );
});

test('scan prints the repository, then each skill with its first sentence, pinned link and unread copies', () => {
  assert.equal(example.code, 0, example.stderr);
  assert.equal(
    example.stdout,
    [
      'JetBrains/example · 1 skill',
      'commits — Write commit messages the way this repository does.',
      `  https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
      '  also in .github/skills/commits/SKILL.md',
    ].join('\n'),
  );
});

test('./fixture: every project skill, sorted by name, linked to its file, with a warning for the malformed one', () => {
  assert.equal(fixture.code, 0);
  assert.equal(
    fixture.stdout,
    [
      'fixture · 5 skills',
      "code-style — Follow the project's code style.",
      `  ${root}/.github/skills/code-style/SKILL.md`,
      'commits — Write commit messages the way this repository does.',
      `  ${root}/.claude/skills/commits/SKILL.md`,
      '  also in .cursor/skills/commits/SKILL.md',
      'commits — Write commit messages for the web app.',
      `  ${root}/web/.claude/skills/commits/SKILL.md`,
      'debugging',
      `  ${root}/.junie/skills/debugging/SKILL.md`,
      'release-checklist',
      `  ${root}/.agents/skills/release-checklist/SKILL.md`,
    ].join('\n'),
  );
  assert.match(fixture.stderr, /^warning: \.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);
});

test('no front matter → the directory name, no description and a warning', () => {
  assert.match(fixture.stdout, new RegExp(`^debugging\n  ${root}/\\.junie/skills/debugging/SKILL\\.md$`, 'm'));
  assert.match(fixture.stderr, /^warning: \.junie\/skills\/debugging\/SKILL\.md: no front matter; using the directory name$/m);
});

test("a skill copied into another agent's folder of its project → one skill at the first path, the copy under also in", () => {
  const copy = readFileSync(join(FIXTURE, '.cursor/skills/commits/SKILL.md'), 'utf8');
  assert.notEqual(copy, readFileSync(join(FIXTURE, '.claude/skills/commits/SKILL.md'), 'utf8'), 'the copy is generated: its text differs');
  const lines = fixture.stdout.split('\n');
  const at = lines.indexOf(`  ${root}/.claude/skills/commits/SKILL.md`);
  assert.deepEqual(lines.slice(at - 1, at + 2), [
    'commits — Write commit messages the way this repository does.',
    `  ${root}/.claude/skills/commits/SKILL.md`,
    '  also in .cursor/skills/commits/SKILL.md',
  ]);
  assert.equal(fixture.stdout.split('.cursor/').length - 1, 1, 'the copy is listed once, as a copy');
});

test("a subproject's skill is a skill of its own, not a copy of the root project's skill of the same name", () => {
  const lines = fixture.stdout.split('\n');
  const at = lines.indexOf(`  ${root}/web/.claude/skills/commits/SKILL.md`);
  assert.deepEqual(lines.slice(at - 1, at + 2), [
    'commits — Write commit messages for the web app.',
    `  ${root}/web/.claude/skills/commits/SKILL.md`,
    'debugging',
  ]);
  assert.doesNotMatch(fixture.stdout, /also in .*web\//);
});

test('a SKILL.md outside an agent skills folder, not directly in a skill directory, or named skill.md is not a project skill', () => {
  const notSkills = [
    'SKILL.md',
    'skills/pdf/SKILL.md',
    '.claude/skills/SKILL.md',
    '.claude/skills/commits/examples/SKILL.md',
    '.claude/skills/review/skill.md',
  ];
  assert.deepEqual(notSkills.filter((path) => !existsSync(join(FIXTURE, path))), [], 'the fixture has each of them');
  const listed = (path: string) => fixture.stdout.includes(`${root}/${path}`) || fixture.stdout.includes(` ${path}`);
  assert.deepEqual(notSkills.filter(listed), []);
});

test('a symbolic link to a skills folder is not followed', () => {
  assert.ok(lstatSync(join(FIXTURE, '.gemini/skills')).isSymbolicLink(), 'the fixture links .gemini/skills to .agents/skills');
  assert.doesNotMatch(`${fixture.stdout}\n${fixture.stderr}`, /\.gemini/);
});

test("without GITHUB_TOKEN, a tree too large for one answer → the root project's skills only, and a warning", async () => {
  const api = 'https://api.github.com/repos/JetBrains/huge';
  const tree = (entries: { path: string; type: string; sha: string }[]) => ({
    status: 200,
    body: { truncated: false, tree: entries.map((entry) => ({ mode: entry.type === 'tree' ? '040000' : '100644', ...entry })) },
  });
  // What GitHub answers, without a token, for a repository with skills in .claude/skills and in web/.
  // web/ is not answered: the scan must not look there.
  const huge = replay({
    [api]: { status: 200, body: { full_name: 'JetBrains/huge', default_branch: 'master' } },
    [`${api}/commits/master`]: { status: 200, body: { sha: EXAMPLE_COMMIT } },
    [`${api}/git/trees/${EXAMPLE_COMMIT}?recursive=1`]: { status: 200, body: { truncated: true, tree: [] } },
    [`${api}/git/trees/${EXAMPLE_COMMIT}`]: tree([
      { path: '.claude', type: 'tree', sha: 'claude' },
      { path: 'web', type: 'tree', sha: 'web' },
    ]),
    [`${api}/git/trees/claude`]: tree([{ path: 'skills', type: 'tree', sha: 'claude-skills' }]),
    [`${api}/git/trees/claude-skills?recursive=1`]: tree([
      { path: 'commits', type: 'tree', sha: 'commits' },
      { path: 'commits/SKILL.md', type: 'blob', sha: 'commits-skill' },
    ]),
    [`https://raw.githubusercontent.com/JetBrains/huge/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`]: {
      status: 200,
      body: '---\nname: commits\ndescription: Write commit messages.\n---\n',
    },
  });
  const scanned = await atlas(['scan', 'https://github.com/JetBrains/huge'], { fetch: huge });
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(
    scanned.stdout,
    [
      'JetBrains/huge · 1 skill',
      'commits — Write commit messages.',
      `  https://github.com/JetBrains/huge/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
    ].join('\n'),
  );
  assert.equal(
    scanned.stderr,
    "warning: the tree is too large to list at once; looked only at the root project's skills (GITHUB_TOKEN finds subprojects' too)",
  );
});

test('the CLI prints the result at once and stores nothing', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const scanned = spawnSync(process.execPath, [CLI, 'scan', FIXTURE], { cwd, encoding: 'utf8' });
  assert.equal(scanned.status, 0, scanned.stderr);
  assert.equal(scanned.stdout, `${fixture.stdout}\n`);
  assert.deepEqual(readdirSync(cwd), []);
});

test('unreachable repository → a clear message, exit code 1', async () => {
  const missing = spawnSync(process.execPath, [CLI, 'scan', join(FIXTURE, 'no-such-directory')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /^Not a GitHub URL or a readable directory: .*no-such-directory\n$/);

  // What GitHub answers for a repository that does not exist.
  const notFound = replay({ 'https://api.github.com/repos/JetBrains/no-such-repository': { status: 404, body: { message: 'Not Found' } } });
  await assert.rejects(openGitHub('https://github.com/JetBrains/no-such-repository', { fetch: notFound }), {
    message: 'Repository not found: https://github.com/JetBrains/no-such-repository',
  });

  const offline = await atlas(['scan', 'https://github.com/JetBrains/not-answered']);
  assert.equal(offline.code, 1);
  assert.match(offline.stderr, /^Cannot reach GitHub: not recorded: https:\/\/api\.github\.com\/repos\/JetBrains\/not-answered$/);
});

test('rate limit → a message that asks for GITHUB_TOKEN', async () => {
  const limited = replay({
    'https://api.github.com/repos/JetBrains/MPS': {
      status: 403,
      body: { message: 'API rate limit exceeded for 192.0.2.1. (But here is the good news: ...)' },
    },
  });
  await assert.rejects(openGitHub('https://github.com/JetBrains/MPS', { fetch: limited }), {
    message: 'GitHub rate limit reached; set GITHUB_TOKEN',
  });
});

test('a GitHub URL with tree/<commit> → the skills at that commit, from its tree even with GITHUB_TOKEN', async () => {
  const commit = '1111111111111111111111111111111111111111';
  const api = 'https://api.github.com/repos/JetBrains/example';
  // No code search answer: code search sees only the default branch, so the scan must not use it.
  const pinned = replay({
    [api]: { status: 200, body: { full_name: 'JetBrains/example', default_branch: 'main' } },
    [`${api}/commits/${commit}`]: { status: 200, body: { sha: commit } },
    [`${api}/git/trees/${commit}?recursive=1`]: {
      status: 200,
      body: {
        truncated: false,
        tree: [
          { path: '.agents/skills/commits/SKILL.md', mode: '100644', type: 'blob', sha: 'a' },
          { path: 'src/test/resources/skills/weather/SKILL.md', mode: '100644', type: 'blob', sha: 'b' },
        ],
      },
    },
    [`https://raw.githubusercontent.com/JetBrains/example/${commit}/.agents/skills/commits/SKILL.md`]: {
      status: 200,
      body: '---\nname: commits\ndescription: Write commit messages as of that commit.\n---\n',
    },
  });
  const scanned = await atlas(['scan', `https://github.com/JetBrains/example/tree/${commit}`], { fetch: pinned, token: 'test' });
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(
    scanned.stdout,
    [
      'JetBrains/example · 1 skill',
      'commits — Write commit messages as of that commit.',
      `  https://github.com/JetBrains/example/blob/${commit}/.agents/skills/commits/SKILL.md`,
    ].join('\n'),
  );
  assert.equal(scanned.stderr, '');
});

test('unknown commit → a clear message, exit code 1', async () => {
  const api = 'https://api.github.com/repos/JetBrains/example';
  // What GitHub answers for a commit it does not know.
  const unknown = replay({
    [api]: { status: 200, body: { full_name: 'JetBrains/example', default_branch: 'main' } },
    [`${api}/commits/no-such-commit`]: { status: 422, body: { message: 'No commit found for SHA: no-such-commit' } },
  });
  const scanned = await atlas(['scan', 'github.com/JetBrains/example/tree/no-such-commit'], { fetch: unknown });
  assert.equal(scanned.code, 1);
  assert.equal(scanned.stderr, 'Commit not found: no-such-commit in https://github.com/JetBrains/example');
});
