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

The installed discovery skill is a lightweight entry point: it locates the project's
local `wattpm` and reads release-matched instructions through `wattpm skill`.
For an agent without a skills installer, place the discovery `skills/watt/SKILL.md`
from `platformatic/skills` in the agent's supported skill directory.
Read the agent's documentation for its discovery path; no Watt plugin or generator
is required. Do not overwrite an existing agent instruction file to install a skill.

For example, a project-local Claude Code installation has this layout:

```text
.claude/
  skills/
    watt/
      SKILL.md
```

References remain in the installed npm package and are retrieved through the CLI.
Restart or refresh your agent's skill discovery after manual installation. If it does
not select Watt automatically, ask it to use the `watt` skill and confirm it can read
the local CLI's instructions.

## Select the local release

The discovery workflow requires Watt **3.74.0 or newer** and an installation that
provides `skill`. For older releases or a missing command, stop and report the
requirement; do not automatically upgrade or fall back to another installation.

Locate the installation belonging to the target project or workspace package and use
that same binary for every read. Do not substitute a global binary or let `npx wattpm`
implicitly download the latest version. A v3 installation returns v3 instructions;
a v4 installation returns v4 instructions.

### New projects

Before delegating, agree on the exact published Watt 4 version to use, including a
prerelease version when applicable. Create the minimal package manifest if needed and,
with authorization, install that version locally using the selected package manager.
Then load its skill and scaffold the application with compatible capability versions.
Installing the discovery skill alone does not install Watt or select a major version.

### Migrating an existing Watt 3 project

Select the target Watt 4 release explicitly. Read its version-matched migration guide
or, with authorization, install that exact release in a separate tooling directory and
read `references/migration-v4.md` through its CLI. Identify that binary as the migration
target and use it for all destination references. Keep the project's v3 installation
until the dependency upgrade is an agreed migration step; do not silently switch the
normal discovery workflow to a downloaded v4 binary.

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
./node_modules/.bin/wattpm skill
./node_modules/.bin/wattpm skill references/scaffolding.md
./node_modules/.bin/wattpm skill references/frameworks.md
./node_modules/.bin/wattpm skill references/frameworks/nextjs.md
./node_modules/.bin/wattpm skill references/services.md
./node_modules/.bin/wattpm skill references/integration.md
./node_modules/.bin/wattpm skill references/migration-v4.md
./node_modules/.bin/wattpm skill references/operations.md
```

The command prints Markdown to stdout without changing project files. `FILE` is a
relative filename inside the bundled Watt skill, not an arbitrary local file.
The default is `SKILL.md`. Missing files fail with `PLT_SKILL_FILE_NOT_FOUND`;
invalid paths or extra arguments fail with `PLT_INVALID_SKILL_FILE`.

Relative Markdown links belong to the bundle, not the application or discovery skill
directory. Resolve each link relative to the document containing it, remove any fragment,
and pass the normalized bundle-relative path to the same CLI. For example,
`frameworks/nextjs.md` in `references/frameworks.md` becomes `references/frameworks/nextjs.md`.

## Skill source and distribution

The source of truth is [`docs/skills/watt`](../skills/watt/SKILL.md) in
`platformatic/platformatic`. It is published as searchable documentation and bundled
into each `wattpm` release, including prereleases. The `platformatic/skills` repository
distributes the version-independent discovery skill alongside separate companion skills,
commands, and agents. Make release-specific Watt instruction changes here, including
its framework, deployment, and operations references. Build and packaging copy these
sources into the npm bundle; no cross-repository content synchronization is needed.

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
