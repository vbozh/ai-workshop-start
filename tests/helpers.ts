// Runs the commands the way the CLI does, with GitHub answering from EXAMPLE below, or from a test's own recording.
import { fileURLToPath } from 'node:url';
import { run } from '../src/commands.ts';
import { openGitHub, parseGitHubUrl, type GitHubOptions } from '../src/core/github.ts';
import { replay, type Recording } from '../src/core/replay.ts';
import { openDirectory } from '../src/local.ts';

export const FIXTURE = fileURLToPath(new URL('../fixture', import.meta.url));
export const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

/** The commit GitHub answers for JetBrains/example. */
export const EXAMPLE_COMMIT = '5ab6270ab772d113e8ad52ebfcaa0109c522ae00';

/**
 * What GitHub answers for a small repository, JetBrains/example, with one skill and its copy in
 * .github/skills. The copy's file is not answered: a scan that read copies would fail.
 */
const EXAMPLE: Recording = {
  'https://api.github.com/repos/JetBrains/example': { status: 200, body: { full_name: 'JetBrains/example', default_branch: 'main' } },
  'https://api.github.com/repos/JetBrains/example/commits/main': { status: 200, body: { sha: EXAMPLE_COMMIT } },
  'https://api.github.com/search/code?q=filename:SKILL.md+repo:JetBrains/example&per_page=100&page=1': {
    status: 200,
    body: { total_count: 2, items: [{ path: '.claude/skills/commits/SKILL.md' }, { path: '.github/skills/commits/SKILL.md' }] },
  },
  [`https://raw.githubusercontent.com/JetBrains/example/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`]: {
    status: 200,
    body: '---\nname: commits\ndescription: Write commit messages the way this repository does. Use for every commit.\n---\n# Commits\n',
  },
};

const github = replay(EXAMPLE);

/** `skill-atlas <args>`, as the CLI runs it; GitHub answers from EXAMPLE, through code search, unless a test passes its own. */
export async function atlas(args: string[], gitHub: GitHubOptions = { fetch: github, token: 'test' }) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await run(args, {
    open: (input) => (parseGitHubUrl(input) ? openGitHub(input, gitHub) : openDirectory(input)),
    print: (text) => stdout.push(text),
    error: (text) => stderr.push(text),
  });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}
