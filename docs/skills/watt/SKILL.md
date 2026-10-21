---
name: watt
description: |
  Scaffold, integrate, configure, diagnose, profile, and deploy Platformatic Watt 3 applications.
  Use for watt.json, multi-application workspaces, gateways, services, databases, wattpm commands,
  observability, scheduled jobs, CMS integration, Docker, Kubernetes, and cloud deployments.
  Covers Next.js, Nuxt, Nitro, React Router, TanStack Start, Vite, Express, Fastify, Koa, Remix,
  Astro, NestJS, and external PHP capabilities.
argument-hint: "[init|create|deploy|status] [framework-hint]"
allowed-tools: Read, Glob, Grep, Bash, Write, Edit
---

# Watt 3

These instructions ship with the installed Watt 3 release. The `wattpm skill [FILE]`
command is available starting with **3.74.0**. Prefer writing application files directly
when assisting an agent-driven workflow. Watt 3 still supports its existing generators,
including `create`, `init`, `add`, and import workflows.

## Inspect the project

1. Read project instructions, manifests, lockfiles, configuration, entrypoints, and deployment files.
2. Require Node.js **22.19.0 or newer** in development, CI, and production.
3. Identify the installed Watt version and capability versions. Keep dependencies on major 3;
   do not silently upgrade to Watt 4. Check external capabilities' compatibility separately.
4. Preserve the package manager, module system, workspace boundaries, scripts, and existing topology.
5. Identify public listeners, application IDs, environment variable names, and the requested goal.
6. Preserve unrelated code and secrets. Explain substantial changes and obtain authorization
   before installing dependencies, running migrations, deploying, or executing project code.

Use the project's local Watt installation for CLI checks. Do not fall back to a global
installation or let `npx` download the latest version. If no installation exists, agree
on the target version and installation first. If the version predates 3.74.0 or has no
`skill` command, stop the skill workflow and report the requirement; do not upgrade automatically.

## Configuration contract

- Prefer `watt.json` for new Watt 3 projects. Existing JSON5, YAML, and TOML configurations
  remain supported. Do not rewrite them into Watt 4 `watt.config.*` modules.
- Identify capabilities with `module` or a matching `$schema`. Use the exact installed
  package version for schema URLs rather than copying an old example's version.
- A multi-application root declares `applications` and/or `autoload`; Watt also supports
  the `services` and `web` directory shortcuts. Keep root runtime options at the root.
- A standalone capability can embed orchestration options under `runtime`. Do not add a
  nested `runtime` block to a runtime root merely because a capability example has one.
- Watt 3 uses `entrypoint` and root `server` for the public application. Check the capability
  and custom-command contract before changing listener addresses or ports.
- Environment placeholders such as `{PORT}` are valid. Preserve their required/default
  behavior and document variable names in `.env.example` without exposing secret values.
- Watt 3 tracing configuration is named `telemetry`. Inspect installed schemas before
  borrowing options from another release.
- Native TypeScript stripping does not replace framework builds or type checking and
  does not support every TypeScript language feature.

Installed schemas and source take precedence over generic examples. A requested upgrade
to Watt 4 is a separate migration: obtain destination-version guidance explicitly rather
than applying v4 API or configuration changes during ordinary v3 maintenance.

## Workflow router

| Request | References |
| --- | --- |
| `init`, setup, integrate, port an existing app | [Frameworks](references/frameworks.md), [integration](references/integration.md) |
| `create`, scaffold, add an application | [Scaffolding](references/scaffolding.md) |
| Service, gateway, database | [Services](references/services.md) |
| Enterprise, multi-service | [Enterprise](references/enterprise.md) |
| POC | [POC checklist](references/poc-checklist.md) |
| Logs, traces, metrics | [Observability](references/observability.md) |
| Profiling, CPU, heap, flamegraphs | [Performance](references/performance.md) |
| Cron, scheduled jobs | [Scheduler](references/scheduler.md) |
| CMS, content webhooks | [CMS integration](references/cms-integration.md) |
| Docker | [Docker](references/deployment/docker.md) |
| Kubernetes | [Kubernetes](references/deployment/kubernetes.md) |
| Cloud | [Cloud deployment](references/deployment/cloud.md) |
| Commands, import, resolve, admin | [CLI](references/wattpm-cli.md) |
| Operations | [Operations](references/operations.md) |
| Diagnosis | [Troubleshooting](references/troubleshooting.md) |
| Status | Status check below |

Read only the references relevant to the task. Reference examples illustrate individual
concerns; merge them with existing configuration instead of replacing whole files.

## Reading bundled references

`wattpm skill` prints this file verbatim. All relative Markdown links refer to documents
inside the same release's bundle, not files in the user's application or the discovery skill.
Resolve a link relative to the document currently being read, remove its fragment, and
pass the resulting bundle-relative path to the same local `wattpm skill` command.

```sh
wattpm skill references/frameworks.md
wattpm skill references/frameworks/nextjs.md
```

For example, `frameworks/nextjs.md` in `references/frameworks.md` resolves to
`references/frameworks/nextjs.md`. All bundled references are available offline. External
web links provide optional further reading; they are not paths accepted by this command.

## Status check

1. Identify installed versions and report mixed Watt majors or incompatible capabilities.
2. Check Node.js against the installed release's requirement.
3. Inspect recognized configuration files, scripts, build output, application IDs, and listeners.
4. Inspect environment variable names, not values. Deployment-supplied variables do not require `.env`.
5. Distinguish static inspection from schema validation and successful startup. Parsing JSON
   or printing a CLI version does not establish that an application is ready.
6. With authorization, check development startup, representative endpoints/internal calls,
   framework build, production startup, and shutdown. Stop processes started for validation.

Report findings, changes, checks performed, and remaining decisions. The companion agents
and slash commands in `platformatic/skills` are distributed separately from this bundle.
