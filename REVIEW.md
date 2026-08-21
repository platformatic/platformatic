# Adversarial review of `NEW_CONFIG.md`

## Verdict

Do not approve the proposal for implementation yet. The core model is coherent, but the loader, migration, versioning, and public API contracts still contain executable contradictions and missing data paths.

## Blockers

### 1. `resolve` cannot guarantee the topology a later boot will use

`NEW_CONFIG.md:632-655` promises that `resolve` sees every application needed by a later boot, but evaluates with `command: 'exec'` and explicitly leaves command-dependent topology unenforced. A legal callback can return a remote application only for `command === 'start'`; `resolve` can never see it, while `start` cannot proceed without it. The proposed error merely diagnoses an unrecoverable loop.

**Required correction:** either make topology statically inspectable and command-invariant, or let `resolve` evaluate the exact target context, including the boot command (for example, `resolve --command start --mode staging`).

### 2. Disabled remote entries have no specified transport path to `resolve`

`NEW_CONFIG.md:656-667` and `NEW_CONFIG.md:1479-1491` say `resolve` reads remote entries before `enabled` filtering. However, the root worker filters them and posts only `{ config, importedFiles }` (`NEW_CONFIG.md:1601-1604`). The current consumer reads only `config.applications` returned by `loadConfiguration` (`packages/wattpm-utils/lib/commands/external.js:413-433`). Once the worker exits, the pre-filter list is gone.

**Impact:** an `enabled: false` remote remains invisible, preserving the v3 hole the proposal claims to close.

**Required correction:** return a canonical pre-filter `resolveCandidates` list in the worker protocol, or move filtering main-side after that list has been exposed.

### 3. The configuration-version mechanism does not identify the authored dialect

`NEW_CONFIG.md:2239-2255` requires `$schema` only for machine-generated plain objects and claims imports identify other files. Imports identify the packages installed **now**, not the major against which the file was authored: a v4-shaped file loaded after upgrading dependencies to v5 imports v5 helpers. If the v5 schema overlaps, validation need not fail. The document concedes at `NEW_CONFIG.md:2262-2272` that markerless plain objects are indistinguishable after evaluation.

**Impact:** the promised actionable major-version detection and future migration path are not enforceable.

**Required correction:** require an enumerable, serializable format marker on every canonical export. `defineConfig` and capability factories can stamp it; dependency-free objects must state it explicitly. A string marker is plain serializable data, so the rejection of all branding at `NEW_CONFIG.md:2267-2270` is a false dichotomy.

### 4. The management API simultaneously keeps and removes the same endpoint

`NEW_CONFIG.md:2295-2313` says `GET /applications/:id/config` survives. `NEW_CONFIG.md:3416-3429`, `NEW_CONFIG.md:3676-3680`, and the cross-repository plan at `NEW_CONFIG.md:3749-3753` remove it. The current route directly exposes `runtime.getApplicationConfig()` (`packages/runtime/lib/management-api.js:204-208`), whose post-transform view is explicitly not replaced by `resolvedConfig`.

**Impact:** runtime, control, watt-admin, and ICC consumers cannot implement against one contract.

**Required correction:** choose one behavior. The proposal's own raw-versus-transformed distinction supports retaining the application endpoint and removing only root `GET /config`; otherwise specify a replacement for the transformed worker view.

### 5. Invalid v3 IDs cannot be safely auto-renamed as proposed

`NEW_CONFIG.md:2579-2585` converts `my_app` to `my-app` as a reported divergence, but there is no uniquely correct replacement. It can also collide with an existing `my-app`. More importantly, IDs are referenced by `dependencies` and capability configuration as well as by hostnames and tooling (`NEW_CONFIG.md:3567-3575`); the migration algorithm does not rewrite or even inventory those references. The divergence list nevertheless says refusal is not better (`NEW_CONFIG.md:3169-3177`).

**Impact:** migration can emit a configuration that validates but has broken dependency or gateway routing, or can fail only during post-write validation because two IDs collapsed to one.

**Required correction:** make invalid or colliding IDs a preflight refusal unless the user supplies an explicit old-to-new mapping and migration can update every configuration reference. Source-code hostname references must still be reported.

### 6. Legacy application config filenames are omitted from structural-path resolution

`NEW_CONFIG.md:2970-2984` declares exactly four structural positions, but v3 also permits paths in `applications[].config` and `autoload.mappings[].config`. Current runtime code resolves and loads those paths (`packages/runtime/lib/config.js:222-236` and `packages/runtime/lib/config.js:381-384`), and `NEW_CONFIG.md:3265-3268` promises to record and delete every custom config filename. A placeholder-derived config filename must therefore be resolved before the migrator can read, classify, emit, validate, or delete it.

**Impact:** a valid v3 project using `{APP_CONFIG}` can be misclassified, left with a legacy file, or fail after writes.

**Required correction:** add both config-filename positions to structural resolution and the preflight unresolved-path refusal.

### 7. A second ordinary install does not reliably execute scripts skipped by `--ignore-scripts`

`NEW_CONFIG.md:3034-3051` claims that rerunning the package manager after commit executes exactly the dependency builds and lifecycle hooks skipped by the first install. Yet `NEW_CONFIG.md:3072-3075` also calls an already-installed second run a no-op. For npm, the documented recovery after an install with `--ignore-scripts` is `npm rebuild`, specifically because a subsequent no-op install is not the rebuild contract. Other package managers also have package-manager-specific rebuild/approval behavior.

**Impact:** native addons and generated dependency artifacts can remain unbuilt after a migration that reports success.

**Required correction:** define and test a per-package-manager deferred lifecycle protocol (`npm rebuild`, the appropriate pnpm/yarn equivalent, plus explicit root workspace lifecycle handling). Do not describe a generic second install as equivalent.

## High-priority correctness issues

### 8. `autoload` expansion has two owners

`NEW_CONFIG.md:1448-1455` says the root eval worker is the **only** expansion site and that runtime transform consumes an already-expanded list. `NEW_CONFIG.md:1641-1644` then sends the result through `runtime/lib/config.js` and describes that transform as expanding the application list. The current transform expands `autoload` whenever the property remains present (`packages/runtime/lib/config.js:362-396`) and then filters/prepares entries (`:398-412`).

**Impact:** a literal implementation can scan twice, duplicate or re-merge entries, and perform filesystem reads after the authoritative snapshot phase.

**Required correction:** remove autoload expansion and enabled filtering from the v4 runtime transform, and specify how the original `autoload` declaration remains available for metadata and `--save` tooling without triggering expansion again.

### 9. The claimed capability resolution order is not the repository's current order

`NEW_CONFIG.md:538-546` calls app-scoped-first/runtime-bundled-fallback the unchanged v3 worker order. Current `importCapabilityPackage()` tries a lexical `import(pkg)` first and only then resolves from the application directory (`packages/basic/lib/modules.js:22-36`).

**Impact:** if main-side schema loading follows the proposed app-first order while worker execution remains “unchanged,” one copy validates and another executes. This invalidates the version-skew argument the proposal relies on.

**Required correction:** either preserve the actual bundled/lexical-first behavior everywhere, or declare app-first resolution as a breaking change and update all three paths—schema import, stamp check, and worker implementation import—with layout tests.

### 10. The supposedly exhaustive migration divergence list is incomplete

`NEW_CONFIG.md:3148-3152` says any omitted divergence is a document bug, but known migration-visible changes are absent:

- existing `.env.local` and mode files become active (`NEW_CONFIG.md:3380-3387`);
- `build` resolves `enabled` using production where v3 used development (`NEW_CONFIG.md:3459-3461`);
- `build` now defaults `NODE_ENV=production` where v3 left it unset (`NEW_CONFIG.md:3518-3524`).

The source scan at `NEW_CONFIG.md:3258-3264` does not cover these cases.

**Required correction:** report these divergences when the project contains relevant files, `enabled` objects, or build-time `NODE_ENV` reads, or explicitly weaken the “one exhaustive list” and “never silently” claims.

### 11. Top-level classification is not total

The “four unconditional rules” at `NEW_CONFIG.md:729-759` cover functions and objects. Canonical JSON data can also be `null`, an array, string, number, or boolean; arrays are explicitly supported by the serializability rules at `NEW_CONFIG.md:1781-1806`. None of those top-level exports has a classification rule.

**Impact:** implementations can diverge between incidental property-access failures and AJV errors instead of producing the promised targeted diagnostic.

**Required correction:** after canonicalization, explicitly reject every non-plain-object top-level value with the file path and received type.

### 12. Public DTOs can expose mutable internal configuration

The new DTO embeds nested `resolvedConfig` objects (`NEW_CONFIG.md:2319-2331`), but no deep-copy or immutability contract is specified. Current `getRuntimeConfig()` removes metadata with only a shallow spread (`packages/runtime/lib/runtime.js:1595-1601`), and `getApplicationDetails()` similarly returns configuration fields directly.

**Impact:** a programmatic consumer can mutate data used by later restarts or scale-up workers, bypassing `setApplicationConfigPatch()` and making worker generations disagree.

**Required correction:** return a deep canonical clone, or freeze an independently constructed DTO, from both APIs. Add tests proving mutations of returned values cannot alter runtime state.

## Feasibility gap

### 13. “Constraint intersection” is underspecified beyond simple enums and ranges

`NEW_CONFIG.md:3124-3133` requires proving a non-empty intersection and producing a sentinel before writes, while `NEW_CONFIG.md:3634-3640` includes string patterns and lengths in the constraint table. The proposal does not define handling for combinations involving `anyOf`/`oneOf`, multiple patterns, formats, disjoint branches, or other JSON Schema constraints; AJV validates a candidate but does not compute an intersection or witness.

**Impact:** the migrator can falsely accept an impossible shared variable, invent an invalid sentinel, or introduce unlisted refusal behavior during implementation.

**Required correction:** define a deliberately limited, auditable intersection algorithm. Conservatively preflight-refuse any constraint combination outside that supported subset, and include that refusal in the exhaustive list.
