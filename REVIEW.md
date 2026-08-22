# Adversarial review of `NEW_CONFIG.md` — round 21

## Verdict

The round-20 corrections are mostly coherent, but seven concrete gaps remain. The most serious are introduced by the new four-context `resolve`: it evaluates command contexts that the operator is not preparing and still fails to compare the destination path that determines whether the later boot can find the clone.

## Blockers

### 1. `resolve` now executes unrelated boot configurations and can fail before collecting unchanged topology

To avoid missing command-dependent topology, `resolve` evaluates the root under `exec`, `dev`, `start`, and `build` and fetches their union (`NEW_CONFIG.md:681-708`). The same section explicitly permits non-topology settings to branch on `command` (`:710-713`). Those settings are part of the same root callback and execute before `resolveCandidates` exists.

For example, a production deployment with command-invariant remotes can legitimately contain:

```ts
export default defineConfig(({ command }) => {
  if (command === 'dev' && !process.env.LOCAL_CERT) {
    throw new Error('LOCAL_CERT is required for dev')
  }

  return { applications: [{ id: 'api', url: repository }] }
})
```

`wattpm resolve --production` now runs the unused `dev` branch and fails for a local-only input even though the subsequent `start` would succeed and the remote projection never changes. An async root callback can likewise make one resolve pay four network calls or four 30-second deadlines; “cost nothing measurable” is not enforceable for arbitrary trusted config code.

The contexts are also underspecified against their own defaults: `mode` defaults to development for `dev` and production for `build`/`start`, and `production` is intrinsically true for `build`/`start` (`NEW_CONFIG.md:455-473`), while resolve says the operator's one `--mode`/`--production` choice is carried into all four evaluations (`:714-722`). Either the synthetic contexts violate `ConfigContext`, or one invocation evaluates several deployment modes the operator did not request.

**Required correction:** resolve one explicit target boot context, e.g. `wattpm resolve --for start --mode staging`, using that command's normal defaults. Operators needing multiple targets can invoke it per target. If union resolution remains a goal, introduce a separately evaluable topology projection; evaluating the complete config under every command cannot isolate topology from command-specific settings.

### 2. The cross-command union does not reject different clone destinations

`resolveCandidates` correctly carries `{ id, url, path, gitBranch }` (`NEW_CONFIG.md:732-747`), but the new union only refuses when one ID has conflicting `url` or `gitBranch` values (`:699-708`). `path` is just as load-bearing: current resolution clones into `application.path`, defaulting it from `resolvedApplicationsBasePath` (`packages/wattpm-utils/lib/commands/external.js:422-452`).

A root can therefore return the same ID, URL, and branch but `path: 'external/api-dev'` under `dev` and `path: 'external/api'` under `start`. A union keyed only by ID retains one destination. The other boot then looks in its own missing directory and recommends resolve again, which makes the same choice. Varying `resolvedApplicationsBasePath` by command has the same effect through path backfill.

**Required correction:** compare the canonical effective destination path as part of candidate identity and refuse differing paths, naming both commands and paths. The implementation-plan item at `NEW_CONFIG.md:4439-4447` must also explicitly include the four-context/union/conflict contract rather than describing only the old single candidate list.

### 3. Load-time port overlap is undefined when `hostname` is omitted

The new preflight defines overlap only for explicit wildcards or case-insensitively equal hosts (`NEW_CONFIG.md:1247-1254`). `server.hostname` is optional and has no schema default (`packages/foundation/lib/schema.js:391-400`). More importantly, the actual listener intentionally leaves `host` unset so the underlying framework chooses its own default (`packages/basic/lib/utils.js:18-26`).

Two applications can therefore declare the same fixed port with no host, or one can omit host while the other declares `127.0.0.1`. The loader has no host string to feed the table and cannot know the framework/platform default. Treating absence as equality or wildcard can reject configurations whose listeners would be disjoint; skipping it misses a common collision despite the claim that declared duplicates fail before start.

**Required correction:** either define an effective bind-host default in capability metadata and make every capability honor it, or exclude any comparison involving an omitted hostname from static preflight and leave it to the existing runtime scan over actual bound addresses. Add mixed-capability tests for omitted/explicit hosts.

## High-priority correctness issues

### 4. The scoped multi-app port example still uses the unsafe nullish fallback

The proposal now states that port expressions must use `||`, because `??` converts an empty env value to the valid ephemeral port zero, and claims every port expression follows that rule (`NEW_CONFIG.md:1304-1314`). Eight lines earlier, the canonical scoped multi-app expression is still:

```ts
Number(process.env.PLT_API_PORT ?? 3043)
```

(`NEW_CONFIG.md:1284-1299`). With `PLT_API_PORT=` it binds an ephemeral port instead of 3043. This is especially likely to become generator behavior because the paragraph explicitly calls it the code-first scaffolding equivalent.

**Required correction:** change the scoped expression and generator contract to `Number(process.env.PLT_API_PORT || 3043)`, or use the same canonical integer parser promised for zero-config synthesis.

### 5. The watcher both supports out-of-project applications and says every watched path is project-local

The watcher promises to include the config file of every application, explicitly including an application whose `path` is outside the project (`NEW_CONFIG.md:1978-1989`). `ctx.addWatchFile(path)` also accepts an unconstrained path (`:2001-2007`). The next sentence says all watched paths are project-local (`:2009-2012`). Out-of-tree applications are otherwise a supported runtime layout (`NEW_CONFIG.md:1562-1581`).

An implementation that applies the stated project-local filter drops exactly the external app config it promised to watch, so edits do not reload. An implementation that does not filter contradicts the stated watcher bound. Relative `addWatchFile` paths are also undefined—relative to cwd, `ctx.root`, or the calling helper.

**Required correction:** state that explicit application, `envfile`, `--env`, and `addWatchFile` paths may be outside the runtime root; filter only dependency paths under `node_modules`. Define relative `addWatchFile` paths against `ctx.root`, canonicalize them, and test an external app plus an external declared data file.

### 6. Migration has no preflight rule for a missing per-app `envfile`

V4 makes every explicitly named missing `envfile` a load error (`NEW_CONFIG.md:2423-2428`, `:2450-2462`). V3 silently ignored a missing application env file—the current worker catches the read failure and continues (`packages/runtime/lib/worker/main.js:235-263`). Migration rewrites per-app envfile paths but only enumerates refusals for a root `envfile` and an application in the root config's own directory (`NEW_CONFIG.md:2912-2923`, `:3416-3425`, `:3659-3667`).

Thus a valid v3 application with `envfile: 'deploy.env'` and no such file has no specified migration outcome. A literal application of the later `realpath` rule fails preflight with an unclassified filesystem error; if absent paths are tolerated there, migrate emits the declaration and step-3 v4 loading rejects it after files and dependencies have changed. This is a fully computable incompatibility missing from the exhaustive refusal list.

**Required correction:** add a missing per-app envfile preflight refusal with the manual choices: create the intended file, or remove the declaration after reviewing which conventional `.env*` files v4 would activate. Test the v3 ignored-missing-file case before any write occurs.

### 7. `realpath` cannot canonicalize an ordinary absent resolution directory

Migration containment says every touched path—including `resolvedApplicationsBasePath`—is canonicalized through `realpath` before comparison (`NEW_CONFIG.md:3608-3624`). V3 accepts that property and defaults it to `external` (`packages/foundation/lib/schema.js:1541-1544`). A valid config can explicitly retain that value while no remote has been resolved yet, so the `external` directory does not exist. Node's `realpath` fails on a nonexistent path.

The proposal simultaneously excludes the resolution subtree from migration because it belongs to cloned repositories (`NEW_CONFIG.md:3093-3105`). Requiring the absent base itself to pass `realpath` either aborts an ordinary clean migration with a filesystem error or forces creation of a directory migration otherwise promises not to touch.

**Required correction:** canonicalize the nearest existing ancestor and append the unresolved suffix for containment checks, or omit an absent resolution base from the touched-path set. If the base exists, still resolve it to detect symlink escapes. Cover both absent and symlinked bases in preflight tests.
