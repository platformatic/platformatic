# Adversarial review of `NEW_CONFIG.md` — round 20

## Verdict

Round 19 closed its headline findings, but the proposal still has several contradictory or incomplete execution contracts. The largest remaining issue is that `resolve` still evaluates a different command context from the boot it is preparing, while merely declaring the resulting topology difference illegal. The port preflight, environment behavior, watcher inputs, and migration resume manifest also remain underspecified.

## Blockers

### 1. `resolve` still cannot see command-dependent remote metadata

The document requires `resolve` to see every entry a later boot needs, then evaluates it with `command: 'exec'` while `dev`, `start`, and `build` receive different values (`NEW_CONFIG.md:667-672`). It declares command-dependent topology forbidden but deliberately leaves the rule unenforced because checking would require another evaluation (`:674-683`). The mode flags do not solve that mismatch: they align `mode` and `production`, not `ctx.command` (`:684-690`).

A valid typed config can therefore contain:

```ts
applications: command === 'start'
  ? [{ id: 'billing', url: productionRepository, gitBranch: 'release' }]
  : []
```

`wattpm resolve --production` evaluates the `exec` branch and clones nothing. `start` then evaluates the `start` branch and reports a missing directory while recommending a command that cannot discover it. The same failure occurs without changing the ID set if `url`, `path`, or `gitBranch` varies with `command`; the stated rule only talks about the application set.

**Required correction:** evaluate resolution in the exact target command context, for example `wattpm resolve --for start --mode staging`, and carry the target command into `ConfigContext`. Alternatively, remove `command` from every topology-producing expression by construction. A runtime error that merely names an unenforced rule is not a recovery mechanism.

### 2. The declared-port preflight rejects valid ephemeral listeners and promises diagnostics it cannot produce

`port: 0` is explicitly the supported ephemeral spelling and multiple applications may use it safely because the OS assigns distinct ports (`NEW_CONFIG.md:1113-1117`). The preflight later says any two enabled applications declaring the same concrete port on overlapping hosts are rejected (`:1194-1198`). As written, two `port: 0` applications are duplicates. The special rejection for `port: 0` applies only to `perWorkerIncrement` (`:1403-1410`), so shared/ordinary ephemeral listeners need an explicit exclusion from every collision range.

The same paragraph says the load-time error can name the environment variable that produced the collision (`:1200-1202`). It cannot: arbitrary JavaScript has already reduced `process.env.PORT`, a helper call, or an async lookup to a number, and the worker protocol deliberately carries no provenance (`NEW_CONFIG.md:1811-1819`). It also says all ports are known “once the root worker returns” (`:1194-1196`), before the phased per-app workers have evaluated their files (`:1561-1565`, `:1689-1715`).

Finally, “overlapping hostnames” has no algorithm. Wildcard binds overlap loopback/specific addresses, IPv4 and IPv6 wildcard behavior is platform-dependent, and DNS names can resolve to the same address. Those cases are not all statically decidable from two strings.

**Required correction:** run this check after every per-app evaluation; exclude port zero except for the explicit invalid increment mode; reserve complete `perWorkerIncrement` ranges using the maximum worker count; define a conservative bind-host overlap table; and report only applications, host, and numeric port. Leave cases requiring name resolution or custom listeners to the existing runtime/OS collision path.

### 3. Topology-key stripping makes the same per-app file produce different capability configuration by boot style

The proposal says duplicate-source rejection keeps root and standalone boots identical on capability configuration, with only root-owned `env`/`envfile` layers differing (`NEW_CONFIG.md:374-380`). It later adds a third difference: a per-app worker strips declared `PLT_<ID>_URL` keys under a root boot, while the same file runs as the root worker and cannot be stripped when booted standalone (`:2236-2250`, `:2371-2396`).

For a per-app file containing `origin: process.env.PLT_API_URL`, an app-local `.env` value is absent during root-directed evaluation and present during standalone evaluation. The factory result—and potentially `server.port`, cache endpoints, or build output—is therefore different even when no root entry env block exists. This is exactly the cross-context topology problem: standalone evaluation cannot discover sibling IDs without executing the ancestor configuration it intentionally does not load.

**Required correction:** do not strip topology-looking keys during config evaluation. Runtime injection already outranks env files, so keep evaluation deterministic across boot styles and issue a warning only where the exact key set is actually known. Otherwise explicitly abandon the capability-configuration invariance claim and include topology stripping in every standalone divergence warning and build contract.

### 4. The resume manifest cannot reproduce the placeholder analysis the proposal now requires

The migration analysis correctly says constraints are grouped by effective supplier rather than variable spelling (`NEW_CONFIG.md:3508-3523`) and that embedded placeholders retain the whole interpolation and require a joint witness (`:3552-3574`). `--resume` skips that lexical analysis, so the manifest must preserve both facts. Instead, its specified placeholder record still stores only “a variable, a JSON path and a target type” (`:3796-3800`).

That representation loses:

- which env file/real-environment scope owns the position;
- the complete interpolation expression and its component variables;
- the constraint set and joint witness or selected sentinel;
- whether an existing supplied value, rather than a synthesized witness, was validated.

After `--no-install`, resume can therefore merge constraints that belonged to separate app environments or seed components independently and fail the generated enum/pattern even though preflight had accepted it.

**Required correction:** persist the complete analyzed groups and final witnesses/sentinels, including supplier identity and whole interpolation records, or rerun and verify the lexical pass on resume. The manifest schema should be specified and round-tripped in tests for two app-local values with the same key and for a multi-variable enum interpolation.

### 5. The operative autoload migration algorithm still contradicts the normalized-ID fix

The main generation algorithm says an autoload mapping is emitted only when the raw v3 ID differs from the package-derived v4 default, and an existing mapping ID is carried “verbatim” (`NEW_CONFIG.md:2887-2900`). That still emits no mapping for a directory/mapping ID such as `my_app` when the package has no different name, or carries the invalid spelling unchanged.

Breaking change 25 later says the opposite: normalize every v3 autoload ID first, compare the legal ID, emit mappings for illegal-label changes, and run collision/reference rewriting over the complete normalized set (`NEW_CONFIG.md:4084-4101`). The implementation plan points migrate at the earlier generation section, so these are two executable algorithms, not harmless repetition.

**Required correction:** replace the earlier algorithm with the BC 25 algorithm. Define one final-ID table for explicit and autoloaded entries, including DNS case-folding and `PLT_<ID>_URL` normalization, and use it for mapping emission, collision refusal, and every reference rewrite.

### 6. Detector-only entries create a third undefined `envfile` shape

An entry with no inline definition and no per-app config file spawns no eval worker; its capability is detector-derived (`NEW_CONFIG.md:1739-1756`). The `envfile` section says every entry without an eval worker must reject `envfile`, but claims there are only two such shapes and enumerates inline definitions and the deciding-directory entry (`:2293-2311`). A normal explicit entry such as `{ path: 'web/api', envfile: 'deploy.env' }`, with no `web/api/watt.config.*`, is a third shape.

Either the detector entry is rejected, making the exhaustive two-shape rule false, or `deploy.env` applies only at worker runtime, recreating the evaluation/runtime split used to justify rejecting inline `config` plus `envfile`. It is also unclear whether the promised missing-file check runs for this path.

**Required correction:** reject `envfile` on every detector-only entry and include it in the schema/error/migration rules, or define a per-app evaluation phase for detector synthesis. Do not permit a runtime-only env file under a contract that says it governs both views.

## High-priority correctness issues

### 7. The canonical Level 2 example still reintroduces the global-port collision

The new summary correctly explains that a single-app `process.env.PORT` expression does not travel into a monorepo and must become a scoped `PLT_<ID>_PORT` variable (`NEW_CONFIG.md:40-58`). The canonical Level 2 per-app example nevertheless uses `process.env.PORT` (`:249-272`) while calling the expression identical to the single-app form (`:252-253`) and Goal 4 still promises that the definition moves unchanged (`:197-198`). Appendix B again says the `next({ … })` expression containing `PORT` moves verbatim into a monorepo (`:4568-4583`, `:4624-4626`).

**Impact:** users copying the documented default monorepo shape reproduce the deterministic collision that the new summary warns against as soon as an operator supplies global `PORT`.

**Required correction:** use `PLT_FRONTEND_PORT` in every multi-app example and narrow “moves unchanged/verbatim” to structure and dependency placement. The port expression is an acknowledged edit, so the proposal must stop promising byte identity for the full definition.

### 8. The ancestor scan is simultaneously behavior-changing and diagnostics-only

The Scope section now correctly says the ancestor filename scan selects the env root and can change callback output, ports, required variables, and whether evaluation throws (`NEW_CONFIG.md:965-979`). A later part of the same File Resolution section still says the ancestor check “governs diagnostics only” and cannot change whether boot happens (`:1467-1470`). The env section confirms that this scan finds the outermost config and activates every intervening env file (`:2184-2195`, `:2219-2234`).

These requirements lead to different loaders and different security boundaries. In the behavior-changing implementation, an unrelated `$HOME/watt.config.*` can activate `$HOME/.env` and intermediate secrets in a nested package even though executable config discovery stops at `package.json`.

**Required correction:** delete the diagnostics-only invariant and specify a bounded standalone env-root rule. At minimum, test and prominently document the ancestor data trust boundary; preferably stop at the package/workspace boundary unless the runtime root is explicitly supplied by root-directed fan-out or `--config`.

### 9. The watcher omits explicit env inputs and arbitrary declared config dependencies

The watcher claims to cover everything a reload depends on, then lists mode-aware `.env*` candidates, autoload membership, config candidates, package manifests, and imported files (`NEW_CONFIG.md:1879-1900`). It does not include an entry's explicit `envfile`, even though that file governs config evaluation and worker runtime (`:2277-2308`), or the invocation-wide `--env` file, which replaces the entire env rung (`:2319-2324`). Editing either during `wattpm dev` leaves the evaluated configuration and worker environment stale.

Code-first config may also read a local data file through `readFile()` rather than import it; the module hook cannot discover that dependency. This limitation is currently unstated.

**Required correction:** always watch explicit `envfile`/`--env` paths and all recognized candidate paths, including creation/deletion. Add a context API such as `ctx.addWatchFile(path)` for non-import config dependencies, or explicitly document that direct I/O requires a manual restart.

### 10. `NODE_ENV=''` no longer matches the v3 behavior the proposal claims to preserve

The v4 ladder defaults `NODE_ENV` only when no source supplied the key and says this matches v3 under production boot (`NEW_CONFIG.md:2138-2144`, `:4016-4021`). V3 tests truthiness instead: `if (appConfig.isProduction && !process.env.NODE_ENV) process.env.NODE_ENV = 'production'` (`packages/runtime/lib/worker/controller.js:124-125`). An empty real-env or env-file value is therefore replaced with `production` in v3 but retained as empty in the proposed first-defined-source ladder.

**Required correction:** treat the empty string as missing for this one compatibility default, or declare and migrate/report the behavior change.

### 11. The promised background startup state has no output shape

The Node analysis correctly concludes that `background` is a third startup state learned only after application code runs (`NEW_CONFIG.md:1353-1362`). The immediately following contract says the report has only two shapes and shows only `listening` and `mesh-only` rows (`:1364-1375`). The discussion of why there is no “did not start” state does not define how `background` is represented (`:1377-1397`).

**Required correction:** add an explicit row such as `jobs background — no HTTP dispatch target`, define the worker signal that selects it, and expose the same listening/mesh-only/background classification in application details or runtime metadata.

### 12. The breaking-change inventory omits removal of the public `getRuntimeConfig(true)` overload

The DTO section removes `getRuntimeConfig(true)` because it exposes live `#config` (`NEW_CONFIG.md:2607-2622`). It is a currently declared public overload (`packages/runtime/index.d.ts:378-383`) with different return semantics (`packages/runtime/lib/runtime.js:1595-1601`). Breaking change 14 mentions a new `getRuntimeConfig` payload but never states that a legal invocation is removed (`NEW_CONFIG.md:3917-3927`), and the type sketch defines no replacement metadata DTO.

**Required correction:** list the overload removal explicitly in the BC inventory and define the replacement metadata accessor's programmatic and control-client types, including `root`, `configPath`, and `autoload`.

### 13. Zero-config synthesis converts an empty `PORT` into a valid ephemeral listener

Zero-config synthesis uses `Number(env.PORT ?? 3042)` (`NEW_CONFIG.md:1258-1266`). An env file containing the ordinary empty assignment `PORT=` supplies `''`, so nullish fallback does not run and `Number('')` becomes `0`. The application silently binds an OS-assigned port rather than the documented 3042 default. A non-numeric value similarly becomes `NaN` and fails later without a targeted environment error.

**Required correction:** validate the original string before conversion. Treat an empty value as missing or reject it explicitly, accept only a canonical integer in the supported port range (including an intentional literal `0` if ephemeral binding through env is supported), and name `PORT` in the error.
