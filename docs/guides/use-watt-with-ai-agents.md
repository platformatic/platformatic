# Use Watt with AI Coding Agents

Watt 4 uses agent skills instead of interactive project generators. An agent reads
the official skill and writes code and configuration directly, preserving your
framework, package manager, workspace layout, and existing application behavior.

## Install the skill

Install the official skill in your project with:

```sh
npx skills add platformatic/skills --skill watt
```

Select your local agent and project-level installation in the installer. Use its
global installation option only if you want the skill available in all projects.
The skill follows the [Agent Skills standard](https://agentskills.io/) and can be
used with Claude Code, Cursor, GitHub Copilot, Gemini CLI, and other compatible agents.

For an agent without a skills installer, place `SKILL.md` and the complete `references/`
directory in the agent's supported skill directory. Keep their relative paths intact.
Read the agent's documentation for its discovery path; no Watt plugin or generator
is required. Do not overwrite an existing agent instruction file to install a skill.

For example, a project-local Claude Code installation has this layout:

```text
.claude/
  skills/
    watt/
      SKILL.md
      references/
        scaffolding.md
        frameworks.md
        services.md
        integration.md
        migration-v4.md
        operations.md
        # Additional references, including nested framework and deployment guides.
```

Keep the whole skill directory, not just the main Markdown file: the instructions
load references as needed. Restart or refresh your agent's skill discovery after
manual installation. If it does not select Watt automatically, explicitly ask it
to use the `watt` skill and confirm it can read the referenced files.

## Use the skill

Describe the result you want, for example:

- "Create a Watt 4 project with a Fastify API and a gateway."
- "Add Watt to this Next.js application without replacing its existing source."
- "Add a PostgreSQL database application with migrations and endpoint tests."
- "Integrate this existing application into our Watt workspace."
- "Prepare Docker and Kubernetes deployment files for this Watt project."

The agent should inspect your project, read the relevant reference, propose changes,
and write the necessary files. Review configuration and authorize installations,
migrations, downloads, and deployment separately. Watt requires Node.js 24.20.0+.

## Read the skill without an agent

The published `wattpm` package includes an offline copy matching its release:

```sh
npx wattpm skill
npx wattpm skill references/scaffolding.md
npx wattpm skill references/frameworks.md
npx wattpm skill references/frameworks/nextjs.md
npx wattpm skill references/services.md
npx wattpm skill references/integration.md
npx wattpm skill references/migration-v4.md
npx wattpm skill references/operations.md
```

The command prints Markdown to stdout without changing project files. `FILE` is a
relative filename inside the bundled Watt skill, not an arbitrary local file.
The default is `SKILL.md`. Missing files fail with `PLT_SKILL_FILE_NOT_FOUND`;
invalid paths or extra arguments fail with `PLT_INVALID_SKILL_FILE`.

## Skill source and distribution

The source of truth is [`docs/skills/watt`](../skills/watt/SKILL.md) in
`platformatic/platformatic`. It is published as searchable documentation and bundled
into `wattpm`. The `platformatic/skills` repository maintains the agent distribution,
alongside independent companion skills, commands, and agents. Make Watt skill changes
here, including updates to its detailed framework, deployment, and operations references.

For each stable release, the **Sync Watt skill** workflow copies `docs/skills/watt/`
from the released tag to `platformatic/skills/skills/watt/` and opens a pull request
on `sync-watt-skill-<version>` (for example, `sync-watt-skill-4.0.0`). It replaces only
the Watt skill, including deleted files; other skills, commands, and agents are untouched.
Review and merge the distribution PR manually. Re-running the same release updates
its open PR; identical content produces no commit or PR.

Prereleases and drafts are not synchronized. Maintainers can retry a published stable
release through the workflow's manual trigger by providing its tag, such as `v4.0.0`.
The release publishing workflow also calls the sync workflow explicitly, because releases
created with `GITHUB_TOKEN` do not trigger other release-event workflows.

The cross-repository operation requires the `SKILLS_SYNC_TOKEN` Actions secret in
`platformatic/platformatic`. Use a fine-grained PAT limited to `platformatic/skills`
with **Contents: Read and write** and **Pull requests: Read and write**. The workflow
documents the required permissions and organization approval requirements. Do not put
the token in source files or workflow inputs.

## Migration from generators

Watt 4 removes `create-wattpm`, `create-platformatic`, `@platformatic/generators`,
the `create`/`init`/`add` scaffolding aliases, and the `import` command. Use the skill
to create projects and integrate applications. Runtime commands and operational
`wattpm-utils install`, `update`, `resolve`, and `migrate` remain available.

## See also

- [Watt skill](../skills/watt/SKILL.md)
- [Watt CLI](../reference/wattpm/cli-commands.md)
- [Watt 4 migration](./migrate-v4.md)
- [`platformatic/skills`](https://github.com/platformatic/skills)
