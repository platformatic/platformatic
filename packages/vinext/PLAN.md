# @platformatic/vinext capability — implementation plan

## Goal
Build a new `@platformatic/vinext` capability that runs Vinext apps under Watt with the same ergonomics as other Platformatic capabilities:

- `watt dev` → Vinext development server (HMR)
- `watt build` → Vinext production build
- `watt start` / runtime start → Vinext production server
- capability metadata compatible with gateway/basePath handling

Primary inspiration:
- **`../vite` for package shape and most lifecycle behavior**
- **`../next` for edge cases (idempotency, process/child safety, richer tests, config normalization)**
- Vinext author guidance from `cloudflare/vinext` `AGENTS.md` (especially RSC/SSR parity and `createBuilder()` requirement)

---

## Scope (MVP)

1. New package scaffold in `packages/vinext`.
2. Capability class that supports:
   - Development mode (Vinext via Vite API)
   - Production build (App Router + Pages Router)
   - Production start (Node prod server from Vinext)
3. Configuration schema + transform + typed config generation.
4. Test suite equivalent in breadth to `vite` baseline (backlog, metrics, logger/reuse-port, dev/prod smoke).

### Out of scope (first iteration)
- Cloudflare deploy workflow (`vinext deploy`) integration.
- Vinext compatibility scanner/init/lint commands.
- Extra feature flags beyond what is needed to run Vinext under Watt.

---

## Design decisions

### 1) Capability style
Use a **single `VinextCapability` extending `BaseCapability`** (or `ViteCapability` only if reuse is clean after spike).

Reasoning:
- Vinext has non-standard build/start behavior compared to generic Vite static serving.
- We need explicit App Router vs Pages Router build/start logic (like Vinext CLI does).
- Keeping an explicit capability avoids overfitting `ViteCapability` internals.

### 2) Development startup
Default path (no custom command):
- Resolve Vinext from project root (`resolvePackageViaCJS`-style resolution, same spirit as Vinext CLI dynamic resolution).
- Start Vite dev server with config that mirrors Vinext CLI behavior:
  - if user has `vite.config.*`, let Vite load it;
  - else auto-inject `vinext()` plugin and safe defaults.
- Use Platformatic listener capture (`createServerListener`) for url/backlog behavior parity.

Custom command path:
- Respect `application.commands.development` exactly (same pattern as `vite`/`next`).

### 3) Build behavior (critical)
Follow Vinext guidance:
- **App Router build must use `createBuilder().buildApp()`** (not plain `build()`).
- Pages Router build performs client + SSR server builds.

Implementation approach:
- If custom build command exists, delegate.
- Else mirror Vinext CLI build logic using Vite JS API and Vinext plugin resolution.

### 4) Production startup
- Default production startup should use Vinext Node production server (`vinext/server/prod-server` `startProdServer`) against capability output directory.
- Capture actual server URL/backlog like other capabilities.
- Preserve graceful shutdown semantics (close connections / HTTP2 session handling where available).

### 5) Base path and metadata
- Expose gateway meta similar to `vite`:
  - `wantsAbsoluteUrls: true`
  - `needsRootTrailingSlash`: evaluate Vinext behavior; default `true` unless tests prove otherwise.
- Handle basePath consistently between Platformatic app config and Vinext/Next config.

### 6) Versioning and compatibility checks
- Add supported Vinext semver range(s) and fail fast with `UnsupportedVersion` style error.
- Keep check in `init()` (dev) and possibly relaxed in production command mode.

---

## Package/file plan

Create (modeled on `../vite` first):

- `packages/vinext/package.json`
- `packages/vinext/index.js`
- `packages/vinext/lib/capability.js`
- `packages/vinext/lib/schema.js`
- `packages/vinext/schema.json` (generated)
- `packages/vinext/config.d.ts` (generated)
- `packages/vinext/eslint.config.js`
- `packages/vinext/README.md`
- `packages/vinext/LICENSE`, `NOTICE`, `.gitignore`, `.npmignore`
- `packages/vinext/test/*.test.js`

Wire into workspace exactly like other capability packages.

---

## Config schema (initial)

Top-level sections (same conventions as `vite`):
- `logger`, `server`, `watch`, `application`, `runtime`, `vinext`

`vinext` object (MVP):
- `configFile: string | boolean` (parity with Vite package patterns)
- `devServer.strict: boolean` (optional; default aligned with `vite` package approach)
- `appRouter: boolean | object` (optional override; auto-detect by filesystem by default)
- `noCompression: boolean` (forwarded to production server)

Transform behavior:
- force `watch.enabled = false` (same as `vite`/`next` packages)
- normalize booleans/object defaults

---

## Tests plan

Start from `../vite/test` baseline, then add Vinext-specific tests.

### Baseline parity tests
- development start returns URL and serves app
- production build + start serves app
- custom commands respected in all phases
- backlog is passed through correctly
- reuse-port and logger/metrics behavior parity

### Vinext-specific tests
- App Router build path uses `createBuilder().buildApp()`.
- Pages Router build path emits expected client/server output shape.
- Production start loads Vinext prod server and serves:
  - static assets
  - SSR page
  - API route (Pages Router path)
- Base path behavior sanity checks (redirect/canonical form).

### Regression guardrails inspired by Vinext AGENTS
- ensure dev/prod parity for request handling entrypoints where feasible
- avoid changes that only fix one mode

---

## Implementation phases

### Phase 0 — Spike
- Minimal prototype in `lib/capability.js` that:
  - resolves vinext/vite,
  - starts dev,
  - builds app/pages,
  - starts prod server.
- Validate with local fixture app.

### Phase 1 — Package scaffolding
- Add package files and exports.
- Add schema + loadConfiguration/create/transform.

### Phase 2 — Runtime correctness
- URL/listener capture, backlog, idempotent start/stop, graceful shutdown.
- Meta/basePath behavior.

### Phase 3 — Tests
- Port `vite`-style tests first.
- Add Vinext-specific test coverage.

### Phase 4 — Polish
- README/docs.
- Ensure `pnpm -r build`, lint, and tests pass.

---

## Risks and mitigations

1. **Vinext internal API churn (experimental project)**
   - Mitigation: keep tight supported semver range and explicit errors.

2. **RSC/App Router build fragility**
   - Mitigation: enforce `createBuilder().buildApp()` path + tests.

3. **Dev/prod divergence**
   - Mitigation: test both modes for same routing scenarios; mirror Vinext guidance.

4. **Multiple Vite instances / linked install pitfalls**
   - Mitigation: resolve Vite from app root when possible (same principle as Vinext CLI).

---

## Acceptance criteria

- New capability package builds and lints in workspace.
- `watt dev/build/start` works on both a Pages Router and App Router Vinext fixture.
- Test suite covers core lifecycle + Vinext-specific behavior.
- Errors are actionable for unsupported Vinext versions/misconfiguration.
