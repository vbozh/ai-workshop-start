// The real CLI against live GitHub, on real repositories at fixed commits, so the output never
// changes. GITHUB_TOKEN, if set, raises the rate limit; at a fixed commit the scan reads the tree either way.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { CLI } from '../helpers.ts';

const MPS = '1cbf7f783dbc5c74c8e5231d31f61b02829143de';
const ANDROID = '294d4c098cb833f7a457cd891a125de82d4e1715';
const KOOG = '709079e4a34d6c9234583352550e6a2b88a0bb85';

const TOO_LARGE = "warning: the tree is too large to list at once; looked only at the root project's skills\n";

/** `./skill-atlas scan <url>`, as a user runs it. */
function scan(url: string) {
  const result = spawnSync(process.execPath, [CLI, 'scan', url], { encoding: 'utf8', timeout: 60_000 });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('JetBrains/koog: its two Claude skills, not the skills its integration tests load', { timeout: 90_000 }, () => {
  const koog = scan(`github.com/JetBrains/koog/tree/${KOOG}`);
  assert.equal(koog.code, 0, koog.stderr);
  assert.equal(koog.stderr, '');
  assert.equal(
    koog.stdout,
    [
      'JetBrains/koog · 2 skills',
      'add-java-code-snippets-in-docs — Use when the user asks to add Java tabs/examples to mkdocs docs that already have ' +
        'Kotlin examples (files under docs/docs/**.md using === "Kotlin" / Knit INCLUDE+SUFFIX blocks).',
      `  https://github.com/JetBrains/koog/blob/${KOOG}/.claude/skills/add-java-code-snippets-in-docs/SKILL.md`,
      'split-jvm-nonjvm — Splits a class or several classes in the common source set commonMain into JVM and non-JVM ' +
        'parts into jvmCommonMain and nonJvmCommonMain.',
      `  https://github.com/JetBrains/koog/blob/${KOOG}/.claude/skills/split-jvm-nonjvm/SKILL.md`,
      '',
    ].join('\n'),
  );
});

test('JetBrains/MPS: 43 shared skills, each with its .claude copy, and a warning that the tree is too large', { timeout: 90_000 }, () => {
  const mps = scan(`https://github.com/JetBrains/MPS/tree/${MPS}`);
  assert.equal(mps.code, 0, mps.stderr);
  assert.equal(mps.stderr, TOO_LARGE);
  const lines = mps.stdout.trimEnd().split('\n');
  assert.equal(lines[0], 'JetBrains/MPS · 43 skills');
  assert.deepEqual(lines.slice(1, 4), [
    'actions — Guidelines for implementing IntelliJ actions (AnAction).',
    `  https://github.com/JetBrains/MPS/blob/${MPS}/.agents/skills/actions/SKILL.md`,
    '  also in .claude/skills/actions/SKILL.md',
  ]);
  // Each skill: its line, its link in .agents/skills at the commit, and its copy in .claude/skills.
  const entries = Array.from({ length: 43 }, (_, index) => lines.slice(1 + index * 3, 4 + index * 3));
  const unexpected = entries.filter(([, link, copy]) => {
    const skill = /^ {2}https:\/\/github\.com\/JetBrains\/MPS\/blob\/(\w+)\/\.agents\/skills\/([^/]+)\/SKILL\.md$/.exec(link ?? '');
    return !skill || skill[1] !== MPS || copy !== `  also in .claude/skills/${skill[2]}/SKILL.md`;
  });
  assert.deepEqual(unexpected, []);
  assert.equal(lines.length, 1 + 43 * 3);
});

test("JetBrains/android: no project skills, since its .agents folder holds no skill, and a warning that the tree is too large", { timeout: 90_000 }, () => {
  const android = scan(`https://github.com/JetBrains/android/tree/${ANDROID}`);
  assert.equal(android.code, 0, android.stderr);
  assert.equal(android.stdout, 'JetBrains/android · 0 skills\n');
  assert.equal(android.stderr, TOO_LARGE);
});
