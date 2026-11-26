# Skill Atlas

Every agent skill in a repository: `./skill-atlas scan` finds each `SKILL.md` and prints its name,
description and link. A local web view lists skills and displays each file.

```console
$ npm ci
$ ./skill-atlas scan https://github.com/JetBrains/kotlin
JetBrains/kotlin · 6 skills
…
build-tools-bump-gradle-api — Bumps the Gradle API version that Kotlin Gradle plugins are compiled against in the Kotlin compiler repository.
  https://github.com/JetBrains/kotlin/blob/5ab6270ab772d113e8ad52ebfcaa0109c522ae00/.claude/skills/build-tools-bump-gradle-api/SKILL.md
…
```

Set `GITHUB_TOKEN` for a higher GitHub rate limit. `npm test` runs the tests.

Start the local web view with `npm run web`, then open <http://127.0.0.1:4173>. Set `PORT` to
change the port. In a forwarded workspace, bind to all interfaces with `HOST=0.0.0.0 npm run web`.
The page accepts a GitHub repository URL or a URL pinned to a commit.

- [spec/](spec/): what it does. [AGENTS.md](AGENTS.md): the definition of done.
- [fixture/](fixture/README.md): a small repository for the tests.
