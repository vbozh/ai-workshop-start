/** A project skill found in a repository: its SKILL.md, its directory's name and its copies. */
export type SkillFile = { path: string; name: string; copies: string[] };

/** The folders agents load a project's own skills from; `.agents` is the one they share. */
export const SKILL_ROOTS = [
  '.agents/skills',
  '.claude/skills',
  '.codex/skills',
  '.cursor/skills',
  '.gemini/skills',
  '.github/skills',
  '.junie/skills',
];

/**
 * Every project skill: a file named exactly SKILL.md directly in a skill directory of an agent's
 * skills folder, in the repository root or in any directory below it (a subproject). The same
 * skill directory in several agents' folders of one project is one skill, at its first path;
 * the others are its copies, whatever they say. Any other SKILL.md is not a project skill.
 */
export function findSkills(paths: string[]): SkillFile[] {
  const skills = new Map<string, SkillFile>();
  for (const path of [...paths].sort()) {
    const segments = path.split('/');
    const [agent, folder, name, file] = segments.slice(-4);
    if (file !== 'SKILL.md' || !SKILL_ROOTS.includes(`${agent}/${folder}`)) continue;
    const key = JSON.stringify([...segments.slice(0, -4), name]);
    const skill = skills.get(key);
    if (skill) skill.copies.push(path);
    else skills.set(key, { path, name, copies: [] });
  }
  return [...skills.values()];
}
