# Adversarial review of `NEW_CONFIG.md` — round 15

## Verification of the previous review

The merged revisions resolve most of the prior findings:

| Prior finding | Status |
| --- | --- |
| `envRoot` pre-evaluation circularity | Resolved: the executable marker was removed. |
| Deferred callbacks in programmatic object sources | Resolved: they are now rejected. |
| Zero-config synthesis reading ambient `PORT` | Resolved: synthesis reads the resolved env map. |
| Migration refusal scope/preflight | **Not fully resolved:** the refusal list is centralized, but known unfaithful conversions still bypass it. |
| Portless framework apps reported as mesh-only | **Partially resolved:** inactive apps are distinguished, but static validation now rejects valid custom-command apps and makes the proposed status row unreachable. |
| `port: 0` with `perWorkerIncrement` and range overflow | Resolved. |
| Standalone-build warning's missing metadata | Resolved by making the warning non-enumerating. |
| Code-block CI categorization | Mostly resolved by explicit categories; the current inventory count is wrong. |
| Factory-version marker gap | **Unresolved.** |
| `PLT_ROOT` compatibility analysis | Resolved. |
| `magicast` dependency placement | Resolved. |

## New and remaining findings

### P0 — The migration “faithfulness” guarantee still contradicts the algorithm

Goal 6 says every conversion that cannot be performed faithfully is refused before writes and that the preflight list is exhaustive (`NEW_CONFIG.md:179-186`). The migration algorithm knowingly emits behavior-changing output instead:

- an unset number placeholder becomes `0`, where v3 failed validation (`NEW_CONFIG.md:2319-2342`);
- an env-block-backed placeholder becomes `''`, where v3 supplied the block value; the document explicitly calls this “no faithful emission” (`NEW_CONFIG.md:2385-2402`);
- structural paths can be invented from `.env.sample` or `<autoload.path>/<id>`, neither of which was v3 runtime truth (`NEW_CONFIG.md:2591-2608`).

None appears in the exhaustive six-trigger preflight list (`NEW_CONFIG.md:2672-2686`). A review note is not a faithful conversion. Emit a behavior-preserving expression—for example, an implicit `requiredEnv` guard for typed positions—or add every such case to the read-only refusal gate and weaken the conversion scope accordingly.

### P0 — Successful no-VCS/`--force` undo is impossible after the only backup is deleted

The manifest stores the original contents of modified and deleted files, then is deleted on successful completion (`NEW_CONFIG.md:2791-2795`). The proposal nevertheless promises that the printed undo remains VCS-independent for `--force` and no-VCS runs (`NEW_CONFIG.md:2801-2812`). Once an ignored legacy file has been deleted and the manifest removed, neither `git restore` nor the printed `rm` command can recreate it.

Keep a durable backup/journal after success until the user explicitly discards it, or stop promising post-success undo outside version control.

### P0 — The preserved `resolve` containment check is bypassable

The proposal keeps `wattpm resolve` otherwise unchanged (`NEW_CONFIG.md:575-580`) and claims it refuses clone creation outside the project root (`NEW_CONFIG.md:1129-1133`). Current code checks `directory.startsWith(root)` (`packages/wattpm-utils/lib/commands/external.js:444-455`). That treats `/tmp/app-evil` as contained by `/tmp/app`; a symlinked ancestor inside the root can also redirect writes outside it.

Use canonical paths, a `relative(root, target)` boundary check, non-following filesystem checks, and ancestor revalidation immediately before cloning/installing.

### P1 — Existing generated-target collisions are absent from the exhaustive preflight

Migration unconditionally emits a root and per-app `watt.config.*` (`NEW_CONFIG.md:2213-2217`), but the exhaustive preflight list (`NEW_CONFIG.md:2672-2686`) does not check whether any target already exists. A clean tracked hand-written file, ignored target, alternate recognized suffix, or stale `.wattpm-migrate.json` can therefore be overwritten or discovered only after mutation. Validation failures intentionally retain emitted files, worsening the collision state.

Preflight every target path and recognized sibling candidate; refuse any unexpected existing object unless resuming from a matching, hash-verified manifest.

### P1 — External local applications have no coherent migration transaction

Applications outside the runtime directory are explicitly supported (`NEW_CONFIG.md:1123-1133`, `NEW_CONFIG.md:1644-1651`). Migration still emits a config for every local app and edits app-local capability dependencies using one root package manager and lockfile (`NEW_CONFIG.md:2213-2217`, `NEW_CONFIG.md:2633-2644`). For an app in a sibling repository or outside the root workspace:

- the root install may not install the modified app dependency;
- the root dirty-tree check does not protect an independent repository;
- rollback and dependency installation cross an unspecified transaction boundary.

Preflight each affected path's workspace and VCS ownership. Either transact each independent root separately or refuse applications outside the migration transaction root.

### P1 — Static mesh metadata rejects valid custom-command framework apps

The revised model makes a portless framework app a load-time error based on a static capability flag (`NEW_CONFIG.md:1027-1042`). Yet the proposal also says custom-command apps bind whatever their own code chooses (`NEW_CONFIG.md:915-922`). Current Next starts configured development/production commands before checking `server.port` (`packages/next/lib/capability.js:198-210`, `packages/next/lib/capability.js:312-327`). The proposed validation would reject that valid configuration before its command can start.

There is also an internal contradiction: after a load-time error, the promised `NOT STARTED — … needs server.port` startup row (`NEW_CONFIG.md:1044-1060`) can never be printed. Use a configuration-aware capability predicate that accounts for custom commands/listeners, and choose either load-time rejection or startup status reporting.

### P1 — Canonicalization is ordered after operations it claims to protect

Root processing first unwraps the raw export, reads and invokes nested deferred `application.config` values, and expands `autoload` (`NEW_CONFIG.md:1215-1232`). Canonicalization is specified later as step 4 (`NEW_CONFIG.md:1329-1339`). The serializability contract then claims the canonical snapshot is what gets classified and expanded and that the original is never touched downstream (`NEW_CONFIG.md:1493-1509`).

As written, accessors or proxies can run before being rejected, reopening the stated time-of-check/time-of-use problem. Define one executable ordering that first verifies plain objects/descriptors, resolves only explicitly allowed function slots while constructing the snapshot, and performs classification/expansion solely on that snapshot.

### P1 — Sentinel compatibility checks only coarse types, not schema domains

Preflight rejects one variable used at incompatible target types (`NEW_CONFIG.md:2676-2685`), and validation chooses “a member of the enum” or “a number” (`NEW_CONFIG.md:2726-2743`). Matching primitive types are insufficient: two enum positions can have disjoint members, and two numeric positions can have incompatible ranges or integer constraints. No single environment string may validate at every use even though both positions have the same target type.

Define compatibility as a non-empty intersection of all applicable schema constraints and preflight-refuse an empty intersection.

### P1 — Application ID validation is not DNS-label validation

The proposal rejects only IDs containing `@`, `/`, `:`, or whitespace (`NEW_CONFIG.md:715-722`, repeated at `NEW_CONFIG.md:3050-3055`). DNS labels also reject underscores, leading/trailing hyphens, empty labels, labels over 63 octets, and other non-LDH characters.

Validate the complete intended DNS-label grammar and length before using an ID in `.plt.local` hostnames or topology-variable normalization.

### P1 — The migration journal can expose ignored secrets

The proposal explicitly anticipates ignored legacy configs containing secrets, then stores their complete contents in `.wattpm-migrate.json` (`NEW_CONFIG.md:2781-2799`). It specifies no protected location, ignore rule, restrictive file mode, atomic creation, or symlink defense. A normal repository-local write may turn ignored credentials into a plaintext untracked file that is more broadly readable or accidentally committed.

Use an owner-only, non-following, atomically written journal in a protected/ignored location and document its retention and deletion lifecycle.

### P2 — Factory stamps still do not identify every legal v4 config

The document says markerless authored files are version-identified by each factory's `ApplicationDefinition.version` and that the next major keys off it (`NEW_CONFIG.md:1950-1956`). But hand-written `{ module }` definitions intentionally have no stamp (`NEW_CONFIG.md:486-490`, `NEW_CONFIG.md:520-527`), and a legal `defineConfig` root containing only remote or detected applications can contain no factory result.

Those files have neither `$schema` nor another format marker. Add a root format version or narrow the forward-migration claim.

### P2 — `ctx.env` is type-readonly but runtime-mutable

The same context object is reused across callbacks (`NEW_CONFIG.md:380-395`), while `ctx.env` is only typed as `Readonly<Record<...>>` (`NEW_CONFIG.md:3352-3361`). JavaScript configs can mutate it and change what later deferred entries observe, bypassing the `process.env` mutation warning and making results evaluation-order dependent.

Freeze `ctx` and `ctx.env` at runtime, or clone them per callback.

### P3 — The code-block inventory is factually stale

`NEW_CONFIG.md:3194-3197` claims the document has 15 TS, 1 JS, 3 JSON, and 45 unmarked blocks. Parsing the current fences yields 29 blocks total: 15 TS, 1 JS, 3 JSON, and 10 language-unlabelled blocks. None yet carries the proposed category marker.

Generate this inventory in CI or omit the hard-coded count.

---

## Round 16 — additional findings

No `NEW_CONFIG.md` commits landed after round 15, so all unresolved round-15 findings above still apply. This round deliberately excludes them.

### P1 — Package-bounded search silently ignores an ancestor v3 runtime

Legacy candidates are rejected only in directories the bounded config walk or per-app discovery consults (`NEW_CONFIG.md:624-642`). The config walk stops at the nearest `package.json` (`NEW_CONFIG.md:671-689`), and the separate ancestor diagnostic scans only for `watt.config.*` (`NEW_CONFIG.md:1095-1118`).

In a v3 monorepo, running v4 inside a configless subpackage can therefore synthesize defaults without even the warning an ancestor v4 config would produce, while ignoring the ancestor `platformatic.json`. Extend the non-executing ancestor filename scan to the complete legacy candidate set and define whether this is a migrate error or the same diagnostics-only standalone warning used for v4 ancestors. This remains filename-only and does not cross the pre-evaluation execution boundary.

### P0 — ID-only autoload merging can boot a different physical application

The proposal merges an autoloaded entry and an explicit entry solely because their IDs match (`NEW_CONFIG.md:311-317`). Consider an autoloaded local `api` plus explicit `{ id: 'api', url: '…' }`: the shallow merge retains the local `path` and adds the remote `url`. `resolve` then sees an existing path and skips the remote, so boot runs local code even though the explicit entry named a repository. Current runtime code performs this ID-only merge in `packages/runtime/lib/config.js:374-394`, and runtime maps also overwrite duplicate IDs (`packages/runtime/lib/runtime.js:653-660`).

Merge only when canonical paths identify the same application. Reject duplicate IDs across different paths, URLs, or multiple explicit entries.

### P1 — Root topology drives filesystem access before authoritative validation

The root worker expands `autoload` and resolves `enabled` before fan-out (`NEW_CONFIG.md:1215-1238`), while AJV validation occurs only afterward in the main process (`NEW_CONFIG.md:1377-1387`). Invalid `autoload.path`, mappings, IDs, or `enabled` values can therefore drive directory reads and decide which applications are evaluated before AJV rejects the source. v3 validates before transform (`packages/foundation/lib/configuration.js:587-606`).

After canonicalization, validate the unexpanded root shape first. Only validated orchestration data should drive autoload expansion, path access, merging, and enabled filtering.

### P1 — Disabled root-inline applications still execute

The root module is imported and every inline deferred config is awaited before `enabled` filtering (`NEW_CONFIG.md:1223-1243`). An `enabled: false` inline callback can therefore throw or call `requiredEnv()`. More fundamentally, a root-inline factory's static capability import executes before the loader can learn the entry's `enabled` value, so a missing capability can fail boot even for a disabled app.

The promise at `NEW_CONFIG.md:1239-1243` is achievable for per-app files and detector work, not for eager/static root-inline code. Filter validated entries before invoking deferred inline configs, and explicitly narrow the missing-capability/no-evaluation guarantee for root-inline definitions.

### P1 — Command-dependent topology can make `wattpm resolve` permanently ineffective

All non-boot evaluation uses `command: 'exec'`, development mode by default (`NEW_CONFIG.md:407-423`, `NEW_CONFIG.md:2048-2055`). `resolve` must load configuration before selecting missing remote entries (`NEW_CONFIG.md:594-601`; `packages/wattpm-utils/lib/commands/external.js:413-433`). A production-only remote entry—or a root function that emits it only for `command === 'start'`—is invisible to `resolve`, but `start` later requires it and tells the user to run the same ineffective command.

Define an explicit resolve context and mode, preserve unresolved URL entries independently of boot-time `enabled` filtering, or require topology to be command-invariant.

### P1 — Dependency installation runs while the tree is intentionally unbootable

Migration emits v4 files, retains every legacy file, and then runs the package manager (`NEW_CONFIG.md:2633-2653`). During that interval the v4 loader rejects the deliberate coexistence state (`NEW_CONFIG.md:624-632`). Any `preinstall`, `install`, `postinstall`, or `prepare` script that invokes Watt can fail; `--no-install` asks the user to run the same package manager in that state.

Specify a staged install strategy. If lifecycle scripts are suppressed, define when required native rebuilds and prepare steps run safely after legacy deletion; otherwise install and validate from an isolated staging tree.

### P1 — Nested zero-config synthesis loses the documented root env chain

The scope section promises that a monorepo root `.env` still applies when Watt runs inside `web/api` (`NEW_CONFIG.md:1135-1147`). But zero-config synthesis is an object source whose `root` both starts and floors the env walk (`NEW_CONFIG.md:1431-1438`, `NEW_CONFIG.md:1653-1657`). A configless nested app therefore reads only its own directory and misses the ancestor runtime's `.env`.

Use the already-defined, filename-only ancestor diagnostic to determine the env-chain boundary for zero-config synthesis without executing the ancestor config.

### P1 — The dev watcher omits topology inputs

The watcher covers imported modules and env-file candidates only (`NEW_CONFIG.md:1394-1406`). Several load-bearing inputs are not imports:

- autoload directory membership;
- creation or deletion of a recognized per-app config file;
- `package.json` names used for IDs;
- dependencies used by capability detection;
- external application configs outside the project/workspace-local filter.

Editing any of these can leave a running dev topology stale. Watch autoload directories, recognized candidate names, relevant package manifests, and every actual application config path, including supported external apps.

### P1 — Hot-add lacks a config context and watcher lifecycle

Hot-add promises the same per-app evaluation pass as boot (`NEW_CONFIG.md:1996-2013`) but never defines whether callbacks receive the runtime's original `dev`/`start` context or an `exec` context. It also does not say whether imported modules and env files returned by hot-add join the dev watcher, or whether hot-remove unregisters them.

Persist the runtime's evaluation context for hot-add, merge the new dependency graph into the watcher atomically, and remove reference-counted paths on hot-remove.

### P1 — Prerelease capability skew is silently ignored

The factory/runtime skew check errors only on major differences, warns on minor differences, and ignores patch differences (`NEW_CONFIG.md:505-520`). During the explicitly supported alpha/RC period (`NEW_CONFIG.md:3211-3213`), `4.0.0-alpha.1`, `4.0.0-rc.2`, and `4.0.0` all share major, minor, and patch while potentially having incompatible schemas and factories.

Require exact version identity whenever either side contains prerelease components; apply the relaxed major/minor policy only to stable releases.

### P2 — The documented `npx` command does not identify the target migrator major

The proposal instructs users to run unqualified `npx wattpm-utils migrate` and claims invocation-time resolution delivers fixes (`NEW_CONFIG.md:2096-2105`). That command may select a local or cached package, and once a later major is latest it no longer identifies the migrator intended for v3-to-v4 conversion.

Document an explicit major, such as `npx wattpm-utils@4 migrate`, and have the CLI verify both its own version and the source/target migration pair before writes.

### P2 — `--inspect-brk` cannot preserve real-loader equivalence in the main process

The debug path imports one config in the main process and restores only `process.env` (`NEW_CONFIG.md:1412-1429`). Its ESM cache, globals, process listeners, and imported capability dependencies remain mutated. Later main-side schema imports or diagnostics can therefore observe state that a real eval-worker boot would not, contradicting the claim that printed output remains equivalent.

Run the inspectable target in a dedicated long-lived worker or child process rather than in the loader process, or document the debug mode as intentionally non-equivalent.

### P2 — The new DTO can expose mutable internal configuration

The v4 payload places nested `resolvedConfig` objects into `getRuntimeConfig()` and `getApplicationDetails()` (`NEW_CONFIG.md:1967-1979`). Current `getRuntimeConfig()` removes metadata with only a shallow clone (`packages/runtime/lib/runtime.js:1591-1598`). If retained, a programmatic consumer can mutate a returned `resolvedConfig`, changing data used by later restarts or scale-up workers and bypassing `setApplicationConfigPatch`.

Return a deep canonical clone or a runtime-immutable DTO from both APIs.

### P2 — “Versioned DTO” has no DTO-version discriminator

The payload is repeatedly called a versioned DTO (`NEW_CONFIG.md:1967-1979`, `NEW_CONFIG.md:2891-2899`), but the only specified `version` is the capability package version and may be absent. Consumers cannot distinguish DTO protocol revisions from capability versions.

Add an explicit root `dtoVersion` or protocol-version field.

### P2 — Empty-root classification has undefined behavior

Classification rule 4 treats `{}` as a root config with “all defaults” (`NEW_CONFIG.md:649-669`). The current runtime schema requires an application collection (`packages/runtime/lib/schema.js:52-69`), and the proposal does not say whether v4 removes that invariant. If `{}` becomes valid, it is also unclear whether it boots zero applications or invokes capability detection like zero-config mode.

Choose one behavior and encode it consistently in classification, schema, types, and tests.

### P2 — The machine-generated example is invalid in CommonJS packages

The prescribed machine form uses `export default` (`NEW_CONFIG.md:1929-1961`), while `.js` in a `"type": "commonjs"` package is explicitly treated as CJS (`NEW_CONFIG.md:1324-1327`). Other tooling already emits `.mts` for CommonJS packages (`NEW_CONFIG.md:1523-1526`). A machine writer following the shown JavaScript pattern into `watt.config.js` will get a syntax error.

Require machine writers to emit `.mjs`/`.mts` in CommonJS packages or document a `module.exports` form.

### P3 — The “unchanged internal model” claim contradicts the worker protocol

The summary and non-goals say the normalized object workers consume and `transform()` output are unchanged (`NEW_CONFIG.md:81-84`, `NEW_CONFIG.md:152-155`). Breaking change 14 replaces config-file paths with `configPath`, `resolvedConfig`, `module`, and `version`, and workers now receive data rather than paths (`NEW_CONFIG.md:2891-2899`). Root autoload expansion also moves ahead of `transform()`.

State precisely which capability payload remains compatible; do not describe the normalized runtime model or worker-consumed protocol as unchanged.
