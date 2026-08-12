# Adversarial review of `NEW_CONFIG.md`

## Blockers

### 1. The canonical Next.js example does not start

`NEW_CONFIG.md:26-35` calls `next({ cache: … })` a complete single-app configuration, but framework capabilities require `server.port` (`NEW_CONFIG.md:840-849`; confirmed in `packages/next/lib/capability.js:209-211,326-328`).

**Recommended fix:** Require and show a port for socket-only capabilities. Startup reporting must also distinguish an application that is routable through the mesh from one that did not start. Run documented examples in integration tests against the actual runtime schemas and startup behavior.

### 2. Ancestor configs can inject environment values across the trust boundary

The execution boundary excludes ancestor configs (`NEW_CONFIG.md:883-901`), yet environment loading uses the topmost config found beyond that boundary (`NEW_CONFIG.md:903-907`). This also contradicts the statement that environment files are read “never above the boundary” at `NEW_CONFIG.md:1936-1939`.

**Recommended fix:** Never load environment files outside the execution boundary. Above-boundary discovery may inform diagnostics only. Use one explicit trust boundary for configuration execution, environment loading, and path discovery.

### 3. Broad `PLT_*_URL` stripping breaks valid configuration and migration

Migration emits `process.env.X` expressions (`NEW_CONFIG.md:1700-1707`), but every `PLT_*_URL` is removed from config-evaluation environments (`NEW_CONFIG.md:1363-1370`). A legitimate variable such as `PLT_STRIPE_URL` consequently becomes empty even when supplied by the real environment.

**Recommended fix:** Treat only exact topology keys derived from declared application IDs specially. Preserve unrelated variables and real-environment values. Add migration coverage for non-topology `PLT_*_URL` variables.

### 4. Configless standalone boot is not actually standalone

To determine whether the current directory belongs to an autoloaded configless app, Watt must execute the root config and expand `autoload` (`NEW_CONFIG.md:633-642`). That contradicts the claim that a standalone build never evaluates the root (`NEW_CONFIG.md:723-728`). Root side effects, missing secrets, or timeouts can therefore prevent the supposedly standalone app from booting.

**Recommended fix:** Require static application markers/configs, stop re-scoping configless applications, or explicitly document and secure the required root evaluation. Do not claim root-independent standalone behavior when root execution is necessary.

### 5. Remote v3 applications fail on clean deployments

Remote applications allegedly continue working (`NEW_CONFIG.md:515-540`), but `wattpm resolve` only clones and installs them. A fresh CI clone containing a v3 config is then rejected by unconditional legacy detection. Migrating a local resolved cache is not durable.

**Recommended fix:** Require an upstream v4 revision during migration, or define a durable root-owned configuration overlay. Add a clean-cache resolve-and-boot migration test.

### 6. Hot-add becomes an arbitrary code-loading primitive

`POST /applications` and `management:addApplications` now execute discovered configuration code (`NEW_CONFIG.md:1483-1494`). Currently, `management: true` enables all operations by default, and application paths accept absolute or traversing values. `resolvePath` normalizes paths but does not enforce project containment.

**Recommended fix:** Make code loading a separately granted management operation. Enforce containment after `resolve` and `realpath`, reject symlink escapes and unsafe IDs, and repeat containment checks immediately before import.

### 7. The claimed migration scope is not faithful

The migrator claims only two manual exceptions (`NEW_CONFIG.md:1580-1593`), while valid v3 configurations can still change behavior or fail:

- Build subprocesses intentionally lose root and entry `env` blocks (`NEW_CONFIG.md:711-737`).
- Fixed-port applications with multiple workers cannot run on macOS or Windows, with no fallback (`NEW_CONFIG.md:781-796`).

**Recommended fix:** Preserve these semantics, provide supported fallbacks, or add these cases as migration preflight blockers rather than warnings or deferred runtime work.

## Major issues

### 8. Resolved configuration can expose secrets

`--debug-config` prints the fully resolved configuration (`NEW_CONFIG.md:1098-1102`), and public DTOs include `resolvedConfig` (`NEW_CONFIG.md:1454-1464`). These values commonly come directly from secret environment variables. Existing ITC management defaults also expose configuration operations broadly.

**Recommended fix:** Separate internal and public DTOs, redact schema-sensitive values by default, and require explicit privilege or `--show-secrets` for raw output.

### 9. App-scoped schema code executes in the main process

The main process imports an app-resolved `/schema` JavaScript subpath (`NEW_CONFIG.md:972-988`). A compromised application dependency can mutate globals, register hooks, terminate the process, or read main-process secrets. Calling the subpath “light” is not a security property.

**Recommended fix:** Validate in an isolated process or worker, or consume static schema data without executing application-controlled code. Explicitly state that evaluation workers provide cache, environment, and fault isolation—not a security sandbox.

### 10. Serializability requires canonicalization, not only a check

The contract says object properties whose value is `undefined` are omitted (`NEW_CONFIG.md:1163-1171`), but structured clone preserves those properties. Getters and proxies can also return different topology during expansion, checking, and cloning (`NEW_CONFIG.md:938-951,1024-1031`).

**Recommended fix:** Reject proxies and accessors, then construct one canonical plain-data snapshot. Use that same snapshot for classification, expansion, validation, and `postMessage`.

### 11. Inline `envfile` semantics contradict themselves

Inline `config` plus `envfile` is prohibited (`NEW_CONFIG.md:1309-1312`), yet migration emits deferred root-inline callbacks for values supplied by an `envfile` (`NEW_CONFIG.md:1742-1745`).

**Recommended fix:** Define one contract. If deferred inline callbacks can receive root and entry `env` blocks but not `envfile`, remove the unreachable `envfile` conversion and retain it as a preflight exception.

### 12. The implementation plan contradicts the detailed loader contract

The detailed design says the main process computes explicit environments and workers never read environment files (`NEW_CONFIG.md:927-938,965-968`). The implementation plan instead says `.env` is applied in-worker and retains upward-walking `loadEnv` (`NEW_CONFIG.md:2064-2076`).

**Recommended fix:** Make the implementation plan require one main-side, two-directory environment ladder resolver and explicit worker environments. Add tests asserting identical config-time and runtime views.
