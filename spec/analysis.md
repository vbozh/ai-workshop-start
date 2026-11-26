# Repository analysis
## Input
A **GitHub repository** URL, or a local directory
## Output
Every **project skill**: **name**, **description**, **link**
## Architecture
Core: fetch → find → parse. CLI: a *thin client*.
Skill: id = `repo:path`, name, description, commit, copies
## Project skill
A skill an agent loads while it works in the repository:
`<project>/<agent folder>/skills/<skill>/SKILL.md`
- **Agent folders**: `.agents` (the shared one), `.claude`, `.codex`, `.cursor`, `.gemini`, `.github`, `.junie`
- **Project**: the repository root, or *any directory in it*: a subproject's skills count
- **The file**: named exactly `SKILL.md`, *directly* in the skill's directory
- **Copies**: one skill directory in several agent folders of *one project* → one skill, from the first
  folder in the order above; the others are `also in`, not read, even when their text differs (a generated copy)
- The same skill directory in *another project* is a skill of its own, not a copy
- **Not a project skill**: any other `SKILL.md`, such as one at the repository root, in `skills/` a project
  publishes, directly in a skills folder, inside a skill, or named `skill.md`
- *The place decides*, not the purpose: test data laid out as a project is listed; elsewhere it is not
- **Symbolic links** are not followed: a skill reached only through a link is not listed
## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- Without `GITHUB_TOKEN`, a tree too large for one answer → the root project's skills only, and a *warning*
- The name: front matter, else the directory
- The link pins the *scanned commit*
- No front matter, or malformed → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1
