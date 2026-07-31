# Adversarial review of `NEW_CONFIG.md`

**Reviewed:** 2026-07-31

**Scope:** Current `NEW_CONFIG.md` on `feat/new-config-proposal`

**Goal under review:** Watt v4 configuration should be easier and more familiar for frontend developers.

## Verdict

The code-authored configuration direction is sound, but this revision does **not yet
meet the frontend-DX goal**. It preserves Watt's runtime conventions precisely where
frontend developers expect package-local commands, application-local environments,
and command/mode-aware configuration.

Implementation should not begin from this revision until the blockers below are
resolved. In particular, preserving v3 behavior is not automatically the right choice
when that behavior conflicts with established frontend monorepo workflows.

---

## Blockers and high-priority findings

### B1. Package-local `dev` commands boot the entire monorepo

**Severity:** Blocker

**Proposal:** `NEW_CONFIG.md:365-384`

The upward walk deliberately skips the nearest application definition and starts the
root runtime. Consequently, a package-local command such as:

```sh
pnpm --filter frontend dev
```

runs from the frontend package but starts the entire Watt workspace. Turborepo-style
parallel package scripts can each discover and boot the root runtime, producing
duplicate services, port conflicts, and unrelated infrastructure requirements.

This preserves existing Watt behavior, but it is contrary to the package-local command
model familiar to frontend monorepo users.

**Smallest viable adjustment:**

- Make `wattpm dev` boot the nearest application by default.
- Require `wattpm dev --all`, `--root`, or invocation from the root configuration to
  start the complete runtime.
- Scaffold the root workspace script with the explicit workspace-wide form.

---

### B2. The advertised migration command is not a viable release boundary

**Severity:** Blocker

**Proposal:** `NEW_CONFIG.md:9-14`, `136-137`, `293-301`, `671-715`, `756-759`, `811-819`

The runtime refuses v3 configuration and instructs users to run
`npx wattpm migrate`, but the implementation plan allows v4 to ship without the
migrator. The current `wattpm` command router also has no `migrate` route, and the
proposal assigns the implementation to `wattpm-utils` without explicitly adding the
routing and package dependency required by the advertised command.

The dependency transition is also incomplete. Migration emits imports such as:

```ts
import { next } from '@platformatic/next'
```

but promises never to edit `package.json`. Existing projects can still declare
`@platformatic/next@^3`, whose package does not export the v4 factory and whose
`create` implementation follows the unsupported v3 file-loading contract. A config
codemod cannot make an unmodified v3 capability implement the v4 contract. The same
problem is unavoidable for third-party capabilities that have not released v4
support.

Relevant current implementation evidence includes:

- capability dependencies are written with the current Platformatic major in
  `packages/runtime/lib/generator.js:591-597` and
  `packages/wattpm-utils/lib/commands/external.js:161-165`;
- the current Next capability exposes the v3 `create(configOrRoot, sourceOrConfig,
  context)` path at `packages/next/index.js:94-98`;
- the current `wattpm` router contains no `migrate` case at
  `packages/wattpm/index.js:130-185`.

**Smallest viable adjustment:**

- Make a routed and tested `wattpm migrate` command a v4 GA release gate.
- Audit every application capability dependency before writing config.
- Either update supported `@platformatic/*` dependency ranges to v4 with explicit
  user consent, or stop with exact package-manager commands.
- Scope “anything that boots on v3” to in-tree capabilities and explicitly v4-ready
  third-party capabilities.
- Alphas may precede migration tooling; stable v4 must not.

---

### B3. Legacy YAML, TOML, and JSON5 configurations can be silently ignored

**Severity:** Blocker

**Proposal:** `NEW_CONFIG.md:147-149`, `341-350`, `671-684`, `707-713`

Legacy detection is specified only for JSON, while the migration reader claims support
for JSON5, YAML, YML, TOML, and TML. V3 currently recognizes all of those extensions at
`packages/foundation/lib/configuration.js:30` and generates their candidate filenames
at `packages/foundation/lib/configuration.js:122-152`.

An existing project containing only `watt.yaml` can therefore fail to find a v4 code
config and fall through to zero-config detection. Watt may boot with inferred defaults
while silently ignoring the user's server, telemetry, application, and environment
settings. That is more dangerous than a hard failure.

Migration also deletes old files after scanning application sources for references.
That scan cannot reliably find computed paths, package scripts, CI configuration,
deployment tooling, tests outside the scanned tree, or external consumers.

**Smallest viable adjustment:**

- Detect every recognized v3 candidate filename and extension without parsing it.
- Fail with the migration hint whenever any legacy candidate is present.
- Validate that the generated v4 configuration loads successfully before considering
  cleanup.
- Keep or rename legacy files by default.
- Delete them only with an explicit `--delete` flag; retain `--keep` as an alias if
  useful for compatibility.

---

### B4. Environment and phase semantics oppose frontend conventions

**Severity:** Blocker for the stated DX goal

**Proposal:** `NEW_CONFIG.md:168-175`, `245-261`, `359`, `483-485`, `520-537`

The proposed context exposes only a `production` boolean. It cannot distinguish
`build` from `start`, has no mode concept for staging or test builds, and does not
support mode-specific environment files.

Per-application config files are evaluated with the root environment, not the
application's environment. The recommended colocated file:

```ts
// web/frontend/watt.config.ts
export default next({
  cache: { adapter: 'redis', url: process.env.REDIS_URL }
})
```

cannot read `REDIS_URL` from `web/frontend/.env`. That file is loaded only later for
the application worker. The new precedence also makes root `.env` shadow app `.env`,
reversing the existing “more specific app defaults win” behavior documented by
`packages/foundation/lib/configuration.js:395-401` and implemented in
`packages/runtime/lib/worker/main.js:245-259`.

The canonical multi-app example compounds the problem by branching on
`process.env.NODE_ENV`, although the proposal only guarantees the command-aware
`production` context. `wattpm start` or `wattpm build` without an externally supplied
`NODE_ENV` can therefore select the development branch.

Finally, every function export is classified as a root configuration. A frontend
developer cannot write a Vite/Next-style sync or async per-app function that returns an
`ApplicationDefinition`.

**Smallest viable adjustment:**

Expose a context such as:

```ts
type ConfigContext = {
  command: 'dev' | 'build' | 'start'
  mode: string
  production: boolean
  env: NodeJS.ProcessEnv
  root: string
}
```

Then:

- evaluate per-app files with app-local environment layering;
- use a precedence such as `OS environment > app mode/local files > root defaults`;
- support documented `.env`, `.env.local`, `.env.<mode>`, and
  `.env.<mode>.local` behavior, or explicitly provide an equivalent;
- evaluate a function once and classify its resolved value as either `WattConfig` or
  `ApplicationDefinition`;
- rewrite the main example to use the supplied context rather than `NODE_ENV`.

---

### H1. The common single-app API remains too ceremonial

**Severity:** High

**Proposal:** `NEW_CONFIG.md:16-20`, `151-159`, `210-239`, `701-704`, `951-953`

The proposal says a single app and a monorepo use the same file shape and that promotion
is a file move rather than a rewrite. The examples do not support that claim:

- a single app exports a root `WattConfig` containing an `applications` array;
- a monorepo app exports a bare `ApplicationDefinition`;
- promotion requires extracting the inner factory expression rather than moving the
  complete file;
- runtime options must remain or be recreated at the root;
- migrated `{PLT_ROOT}` expressions must be rewritten after moving into a root-inline
  entry, according to `NEW_CONFIG.md:701-704`.

The common Next.js case therefore exposes orchestration machinery immediately:
`applications`, an anonymous entry, a generic `config` property, and a capability
factory. Internal normalization is simpler, but the user-facing API is not simpler
than a familiar frontend config.

**Smallest viable adjustment:**

Add a singular shorthand that normalizes into the runtime model:

```ts
export default defineConfig({
  server: { port: 3042 },
  application: {
    workers: 2,
    config: next({ trailingSlash: true })
  }
})
```

Also resolve capability-relative paths against `ApplicationEntry.path` regardless of
the factory's importing file. Reword the promotion promise to: “the application
definition moves unchanged.”

---

### H2. The examples conflict with the serializability contract

**Severity:** High

**Proposal:** `NEW_CONFIG.md:35`, `231`, `436-445`, `487-495`, `944`

All three primary examples can place `undefined` into the config through
`process.env.REDIS_URL`. `undefined` is not JSON-serializable. Depending on how the
serializability check is implemented, the copy-pasted example either fails before AJV
validation or silently loses the property.

The wider framing also overpromises. “Code-first configuration” suggests ordinary
JavaScript callbacks, plugins, class instances, and imported objects. The proposal
explicitly rejects those values and requires callback-shaped needs to remain file
paths. Native Node type stripping further excludes `tsconfig` paths, enums, parameter
properties, decorators, TS presets published under `node_modules`, and other syntax a
frontend developer may expect a bundled `*.config.ts` loader to handle.

**Smallest viable adjustment:**

- Define deterministic omission of object properties whose value is `undefined`.
- Explicitly reject `undefined` in arrays, non-finite numbers, bigint values, circular
  references, functions, symbols, and non-plain instances with JSON paths.
- Provide typed helpers such as `env.string('REDIS_URL')`,
  `env.number('PORT', { default: 3042 })`, and typed file/module references.
- Describe the format prominently as **TypeScript-authored serializable data**, not
  unrestricted TypeScript configuration.
- Put native type-stripping constraints near the first `watt.config.ts` example rather
  than only in the detailed loader section.

---

### H3. Root-inline factories can type against one capability version and run another

**Severity:** High

**Proposal:** `NEW_CONFIG.md:409-411`, `499-518`

Root-inline factory imports resolve from the root package. Validation resolves the
capability schema against the application root, and runtime implementation loading
continues to prefer the application's dependency.

For example:

- root: `@platformatic/next@4.1` supplies the factory and editor types;
- app: `@platformatic/next@4.0` supplies the schema and worker implementation.

Factory normalization and autocomplete can accept options that app-local validation or
runtime does not understand. This contradicts the claim that editor and runtime
“always agree.” Pnpm's strict layout makes the two dependency locations especially
visible rather than eliminating the version-skew risk.

**Smallest viable adjustment:**

- Resolve factory, schema, and implementation from the same package instance; or
- stamp a capability ABI/package version into factory output and reject mismatches with
  an error naming both resolved package paths and versions.

The version-skew case needs an explicit integration test.

---

### H4. `getRuntimeConfig` cannot retain identical semantics

**Severity:** High

**Proposal:** `NEW_CONFIG.md:138-139`, `617-621`, `749-755`

Goal 7 promises that `getRuntimeConfig` is preserved with identical semantics. The
breaking-change list simultaneously changes application `config` values from file
paths to resolved objects and changes `getApplicationDetails` payloads accordingly.

The current programmatic API returns the runtime's normalized configuration directly
(`packages/runtime/lib/runtime.js:1513-1519`), so consumers observing
`applications[].config` receive a materially different document even if ICC patch
operations remain byte-compatible.

**Smallest viable adjustment:**

Define and version a stable public DTO. Where compatibility is required, preserve a
`configPath` field and add `resolvedConfig` separately. Otherwise withdraw the
identical-semantics claim and explicitly coordinate every in-tree and cross-repository
consumer.

Patch-document compatibility and runtime-config payload compatibility must be treated
as separate contracts.

---

### H5. Eval-worker operational guarantees are not implementable as written

**Severity:** High

**Proposal:** `NEW_CONFIG.md:412-451`

Three guarantees are incomplete or incorrect:

1. A worker isolates the main event loop, but an unresolved async config still leaves
   boot awaiting that worker forever. No timeout or termination policy is specified.
2. Diffing `process.env` before and after evaluation reveals changed keys, but cannot
   identify the importing module and source line that performed each write. The sample
   warning claims attribution that the described mechanism cannot produce.
3. Recording and watching every transitive import includes Watt, capability packages,
   and potentially large `node_modules` graphs. This can exhaust watcher limits and
   trigger reloads for dependency churn unrelated to user config.

`--debug-config` also evaluates in the main process; the proposal should state whether
and how it restores `process.env` after warning, otherwise the warning that mutations do
not propagate is false in debug mode.

**Smallest viable adjustment:**

- Add a configurable evaluation deadline and terminate the worker on expiry.
- Report only mutated keys unless environment writes are genuinely instrumented.
- Watch project/workspace-local config dependencies by default and exclude ordinary
  `node_modules` files.
- Snapshot and restore main-process environment changes made by `--debug-config`.
- Add tests for a never-resolving async config, a crashing config, dependency graph
  filtering, and debug-mode environment restoration.

---

## Additional inconsistencies to resolve

These are smaller than the findings above but should be corrected before the proposal
becomes an implementation contract.

### A1. `$schema` is both removed and mandatory

`NEW_CONFIG.md:576-593` removes `$schema` from the v4 root schema, while
`NEW_CONFIG.md:595-612` requires machine-generated configs to contain it. The loader
must explicitly strip or separately consume this marker before AJV validation, or the
schema must allow it.

### A2. Root/application classification precedence is internally ambiguous

`NEW_CONFIG.md:356-363` says an object with `module` is an application definition before
saying that `module` plus a root-only key is an error. If the rules are applied in the
listed precedence, the error rule is unreachable. Resolve conflict checks before final
classification, or state that `module` always wins.

### A3. The environment precedence omits the two distinct `env` blocks

`NEW_CONFIG.md:560-569` says `real environment > env block > injected > .env files`, but
both runtime and application entries can contain `env`. Current behavior applies root
`env` and then app `env` (`packages/runtime/lib/worker/main.js:264-269`). The v4 ladder
must name both sources and define which one wins.

### A4. Config-writing commands regress despite already adopting AST editing

`NEW_CONFIG.md:637-643` removes `applications:add/remove --save`, requiring manual edits,
while `NEW_CONFIG.md:660-665` already introduces magicast and a safe-shape fallback for
`wattpm import`. The same safe literal-shape strategy can preserve `--save` for the
canonical scaffolded form, with a paste-ready fallback for dynamic configs.

### A5. Migration must not treat `.env.sample` as runtime truth

`NEW_CONFIG.md:697-700` proposes generating JavaScript defaults from `.env.sample`.
V3 does not load `.env.sample` at runtime. Turning sample documentation into executable
defaults can change behavior when a real environment variable is absent. Sample values
may be offered as migration suggestions, but using them should require confirmation or
an explicit policy.

---

## Required acceptance matrix

The design should not be approved until tests cover these user flows:

1. `wattpm dev` in a standalone frontend starts that frontend.
2. `pnpm --filter frontend dev` starts only the selected package.
3. Root `wattpm dev --all` starts the complete runtime exactly once.
4. App-local `.env` values are visible to the colocated app config.
5. Mode-specific local files have documented, tested precedence.
6. `dev`, `build`, and `start` take distinguishable config branches.
7. A missing optional environment value follows the documented `undefined` policy.
8. A never-resolving async config terminates with a targeted timeout error.
9. Root/app capability version skew produces a targeted error.
10. Every v3 extension and candidate filename fails with the migration hint.
11. Migration validates generated output and supports rollback without deleting input.
12. V3 capability dependency ranges are upgraded or rejected with exact instructions.
13. Unsupported third-party capabilities fail before any files are modified.
14. `getRuntimeConfig`, `getApplicationDetails`, and ICC patch DTOs have contract tests.
15. Watch mode observes project-local config helpers without watching dependency trees.
16. CommonJS and ESM package layouts exercise `.js`, `.mjs`, `.ts`, and `.mts` configs.

---

## Decisions required before implementation

| Decision | Question | Required outcome |
|---|---|---|
| D1 | Does package-local `dev` start one app or the whole runtime? | Nearest app by default; workspace startup explicit. |
| D2 | Is migration a v4 release gate? | Yes for stable v4, including CLI routing and dependency checks. |
| D3 | Which legacy files trigger migration failure? | The complete v3 candidate set. |
| D4 | What env and phase model is frontend-facing? | Command, mode, app-local files, and explicit precedence. |
| D5 | What is the canonical single-app shape? | A shorthand optimized for the common case. |
| D6 | What exactly is serializable? | A complete deterministic contract with typed helpers. |
| D7 | Which capability instance owns types, schema, and runtime? | One instance, or a hard version/ABI mismatch error. |
| D8 | Which runtime configuration DTO is public and stable? | Explicit versioned fields for paths and resolved data. |
| D9 | What bounds config evaluation and watching? | Deadline, truthful diagnostics, and project-local graph filtering. |

## Recommendation

Preserve the code-authored configuration direction, but revise the surrounding
semantics before implementation. The three product decisions that most directly
determine whether the result feels familiar to frontend developers are:

1. package-local versus workspace-wide `dev` behavior;
2. application-local environment and command/mode semantics;
3. a low-ceremony single-application shape.

Once those are fixed, the migration, dependency-resolution, public-contract, and
eval-worker blockers should be closed against the acceptance matrix above.
