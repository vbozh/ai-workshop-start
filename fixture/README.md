# fixture

A small repository for the tests.

| Path | Case |
| --- | --- |
| `.claude/skills/commits` | a skill |
| `.github/skills/code-style` | a skill in another agent's folder |
| `.agents/skills/release-checklist` | malformed front matter |
| `.junie/skills/debugging` | no front matter |
| `.cursor/skills/commits` | a generated copy of `.claude/skills/commits` |
| `web/.claude/skills/commits` | a subproject's skill, not a copy |
| `SKILL.md` | not a skill: the repository root |
| `skills/pdf` | not a skill: a skill the repository publishes |
| `.claude/skills/SKILL.md` | not a skill: directly in a skills folder |
| `.claude/skills/commits/examples` | not a skill: inside a skill |
| `.claude/skills/review/skill.md` | not a skill: not named `SKILL.md` |
| `.gemini/skills` | not followed: a symbolic link to `.agents/skills` |
