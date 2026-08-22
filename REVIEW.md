# Adversarial review of `NEW_CONFIG.md` — round 19

## Verdict

The round-18 findings are addressed, but the proposal still has several implementation blockers. The most serious are a generated multi-app port collision, an impossible standalone-ID invariant, incomplete remote-resolution metadata, and migration analysis that incorrectly treats app-local environments as global.

## Blockers

### 1. The canonical `PORT` expression makes generated multi-app projects collide

The canonical and “byte-identical when moved” application definition reads the global `process.env.PORT` (`NEW_CONFIG.md:26-43`, `:1120-1126`). The runtime generator gives applications distinct fallback ports (`:1122`), but the real environment outranks every app-local env file and entry block (`NEW_CONFIG.md:1928-1941`). Therefore, in a deployment that sets the conventional global `PORT=8080`, every generated application resolves to 8080. The runtime then rejects the shared port (`NEW_CONFIG.md:1092-1101`). Framework applications cannot simply omit the port (`:1128-1143`).

**Impact:** a normal platform-provided `PORT` turns a scaffolded monorepo into a deterministic boot failure; app-local `PORT=3042+i` files cannot repair it because real env wins.

**Required correction:** generated multi-app configs need per-app port variables, or only the public app may consume global `PORT` while internal socket-backed apps use `port: 0`. If promotion must remain byte-identical, the loader needs an explicit scoped-port mechanism; the current environment ladder cannot provide one.

### 2. Standalone boot cannot honor a root entry's explicit ID

Per-app files contain capability configuration only and factories reject orchestration properties (`NEW_CONFIG.md:326-329`). A standalone boot never evaluates the root (`:815-825`). Nevertheless, the proposal says one ID rule applies under every boot style and that an explicit configured ID wins (`:825-833`). For a root entry `{ id: 'api', path: 'web/frontend' }`, the root boot uses `api`, while standalone boot can only derive `frontend` from `package.json` or the directory.

**Impact:** the mesh hostname, self `PLT_<ID>_URL`, metrics labels, and `wattpm inject` identity differ by boot style—the exact failure the one-rule claim says is forbidden.

**Required correction:** either give per-app definitions serializable identity metadata, or reject/root-migrate explicit IDs that differ from the standalone-derived ID. The standalone warning is not enough because the document promises identity invariance.

### 3. `resolveCandidates` drops `gitBranch` and has no complete loader API contract

The worker projects remotes to `{ id, url, path }` (`NEW_CONFIG.md:672-680`, `:1477-1483`, `:1639-1645`). Resolution uses `application.gitBranch` to select the revision (`packages/wattpm-utils/lib/commands/external.js:368-390`). A disabled remote pinned to `release` would therefore be cloned from its default/URL branch.

The worker protocol crossing is specified, but the public main-side loader still traditionally returns the config object; the proposal never defines whether `resolveCandidates` is returned as a new result envelope, metadata, or a separate API. Adding it to validated config data would pollute the schema/DTO, while changing `loadConfiguration()` to `{ config, resolveCandidates }` breaks every caller.

**Required correction:** carry `{ id, url, path, gitBranch }` and define a dedicated loader-result contract such as `loadConfigurationWithMetadata()`. Add a disabled remote pinned to a non-default branch as an integration test.

### 4. URL entries permit a missing ID even though path backfill requires it

`ApplicationEntry.id` is optional in the type sketch even when `url` is present (`NEW_CONFIG.md:4102-4107`), but an unresolved remote computes its path from `resolvedApplicationsBasePath` and `id` before a directory or package exists (`NEW_CONFIG.md:622-630`). There is no source from which to derive the ID. The current schema correctly requires `id` for URL entries (`packages/foundation/lib/schema.js:867-895`).

**Required correction:** model local and remote entries as a union and require `id` whenever `url` is present, in schema and generated types.

### 5. The load-time “will serve” predicate is not decidable for Node applications

The proposal first limits genuine Node mesh-only behavior to “node-with-a-factory” (`NEW_CONFIG.md:1138-1142`), then says all `node` applications are statically in-thread-capable and all predicate inputs are configuration (`:1184-1219`). Node discovers its factory, server shape, `isBackgroundApplication`, and module-level `hasServer` only after importing/executing application code (`packages/node/lib/capability.js:196-250`). A background Node application's dispatch target explicitly rejects HTTP (`packages/node/lib/capability.js:439-451`, `:559-560`).

**Impact:** treating Node as mesh-capable admits a configuration later reported as a dead mesh URL; treating it as incapable rejects valid factory-backed mesh applications and background workers that intentionally serve no HTTP.

**Required correction:** add an explicit validated Node serving mode, or defer Node classification until start and support a third `background` status. It cannot be a load-time predicate over capability metadata alone.

### 6. `envfile` is still legal where no config-evaluation worker exists

The proposal rejects `envfile` with inline config because no per-app eval worker exists and the file would affect runtime only (`NEW_CONFIG.md:2120-2143`). But `defineConfig({ application: { workers: 2, envfile: 'deploy.env' } })` has the same problem: discovery skips the deciding file and falls through to the detector (`NEW_CONFIG.md:1544-1553`), so no per-app eval worker exists. The root file has already evaluated without the entry's `envfile`.

**Impact:** this allowed shape contradicts the claim that `envfile` governs both evaluation and runtime views.

**Required correction:** reject `envfile` for every entry that has no per-app eval worker, including deciding-directory detector entries, or explicitly define and report the runtime-only asymmetry.

### 7. Placeholder compatibility is incorrectly intersected across app-local environments

Preflight and validation require one shared value for each variable across every recorded position (`NEW_CONFIG.md:3256-3286`, `:3419-3440`). In v3, each per-app config loads environment files relative to that config (`packages/foundation/lib/configuration.js:344-393`). Two apps may validly use `SETTING` under disjoint schemas because `web/a/.env` and `web/b/.env` supply different values. V4 per-app eval workers preserve that separation.

**Impact:** migration refuses valid projects merely because the same key name has different app-local meanings.

**Required correction:** scope constraint sets and sentinels by effective evaluation environment/config root. Only a value supplied by the real process environment should be tested globally, because that top rung genuinely overrides every app.

### 8. Embedded typed placeholders need joint, not per-variable, analysis

Embedded placeholders become template literals (`NEW_CONFIG.md:2838-2842`), but the manifest/validation record stores each variable independently as `{ variable, path, targetType }` (`:3419-3428`, `:3519-3523`). For an enum position such as `"{PREFIX}{LEVEL}"`, separately valid sentinels need not concatenate to a valid enum value. Likewise, one component may legitimately be empty while the final v3 value is valid, but per-variable `requiredEnv()` rejects it (`:2816-2822`).

**Required correction:** preserve the complete interpolation expression and validate a joint witness after interpolation. Conservatively preflight-refuse embedded/multiple placeholders in non-free-form string positions when a joint witness cannot be proven.

### 9. Resolved legacy config paths can escape the migration transaction

The newly added structural positions include `applications[].config` and `autoload.mappings[].config`, and step 5 deletes those resolved files (`NEW_CONFIG.md:3071-3097`). Preflight only rejects an **application directory** outside the transaction root (`:3222-3236`). V3 permits an in-root application whose config path resolves to `../../shared/platformatic.json` (`packages/runtime/lib/config.js:222-223`).

**Impact:** migrate can read and delete another project's config even though its dirty check, install, and rollback protect only the current transaction root.

**Required correction:** canonicalize and containment-check every file to be read, modified, or deleted—not only application directories. Any external legacy config file must be a preflight refusal.

### 10. Preflight checks existing targets but not collisions among planned targets

Migration emits one per-app `watt.config.*` unconditionally (`NEW_CONFIG.md:2674-2678`). The target preflight checks whether files already exist (`:3238-3254`) but does not require planned outputs to be one-to-one. V3 permits two entries with distinct IDs/config filenames sharing one application directory; both migrate to the same per-app target.

**Impact:** two producers can overwrite the same new file, or validation can fail only after writes.

**Required correction:** build a canonical target-to-producers map before writing. Refuse multiple producers unless a defined root-inline conversion can preserve both configurations; add this to the exhaustive refusal list.

## High-priority correctness issues

### 11. Failed evaluation loses newly discovered watcher dependencies

Import hooks record transitive files (`NEW_CONFIG.md:1624-1628`), but only valid worker results include `importedFiles` (`:1637-1639`). If a config is changed to import a new helper and that helper throws—or evaluation times out—the previous watch set does not contain the helper. Fixing only the helper will not trigger another load.

**Required correction:** include discovered imports in structured error results and stream resolved paths to the parent so timeout termination also preserves them. Keep the union of last-good and failed-load dependencies until the next successful evaluation.

### 12. The DTO contract still collides with existing fields and leaves `includeMeta` live

The new envelope adds `version` to both public payload shapes (`NEW_CONFIG.md:2402-2414`), but `getApplicationDetails().version` already means the running capability version returned over ITC (`packages/runtime/lib/runtime.js:2149-2164`). Those values can differ under the proposal's permitted minor skew. Separately, `getRuntimeConfig(true)` is a typed public overload and currently returns live `#config` directly (`packages/runtime/index.d.ts:378-383`, `packages/runtime/lib/runtime.js:1595-1601`); the new frozen-copy promise (`NEW_CONFIG.md:2416-2428`) never addresses it.

**Required correction:** preserve `details.version` for the running implementation and expose the factory stamp as `definitionVersion`/`factoryVersion`. Remove or privatize `includeMeta: true`, or define a separate deeply cloned metadata DTO and update internal callers.

### 13. The migrated TypeScript example does not typecheck

`requiredEnv()` returns `string` (`NEW_CONFIG.md:4227-4234`) and is assigned to enum-typed `logger.level` (`:4236-4238`), while the proposal promises a literal union for that field. Loader validation may pass at runtime, but TypeScript reports the assignment as too broad. The proposed `config` code-block gate loader-validates examples; only `decl` blocks run `tsc --noEmit` (`NEW_CONFIG.md:3970-3976`).

**Required correction:** emit enum-aware parsing/validation that returns the target union, and typecheck every generated config fixture and every `config` documentation block in addition to loader validation.

### 14. The ancestor scan is not diagnostics-only because it controls env loading

The proposal says the ancestor filename check can only change printed diagnostics and cannot affect whether boot happens (`NEW_CONFIG.md:887-897`, `:1325-1328`). The same scan chooses the outermost env root (`:891-893`, `:1351-1363`). A stray unrelated ancestor `watt.config.*` therefore activates additional `.env` files, which can change callback output, ports, required variables, or whether evaluation throws.

**Required correction:** stop describing the check as diagnostics-only. Prefer a package-bounded env chain for standalone discovery and pass the known runtime env root explicitly during root-directed fan-out; otherwise document the ancestor file as behavior-affecting and strengthen the trust warning.

### 15. Successful undo restores files but leaves the installed v4 dependency tree

The success summary calls `git restore … && rm …` complete (`NEW_CONFIG.md:3525-3541`). The document itself explains that restoring manifests and lockfiles does not restore `node_modules`, and runs the package manager during failure rollback for exactly that reason (`:3551-3558`). The same issue applies after a successful migration is manually undone.

**Required correction:** append the detected package-manager restore/install command to the success undo instructions and do not call undo complete until dependency state has been reconciled.

## Additional migration gap

### 16. Invalid autoload IDs can bypass the new rename path

Explicit invalid IDs are renamed (`NEW_CONFIG.md:2680-2686`), but autoload mappings are emitted only when the v3 ID differs from the v4 package-derived default, and an existing mapping ID is carried verbatim (`:2696-2709`). A directory or mapping named `my_app` with no differing package name therefore remains `my_app`, which the v4 DNS-label rule rejects (`:839-847`).

**Required correction:** resolve and normalize every v3 autoload ID before comparing defaults, then emit a mapping whenever the legal v4 ID differs. Run collision and reference rewriting over that complete normalized set.
