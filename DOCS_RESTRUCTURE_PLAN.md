# Platformatic Documentation Restructuring Plan

## Following the Diátaxis Framework

**Last audited: 2026-07-26** (previous revision: 2025-09-11)

---

## Audit Summary — Read This First

The previous revision of this plan claimed Phase 3 was "❌ NOT STARTED". **That is wrong.** Phase 3
content was written and merged in PR #4275 (`doc: Phase3 strategic content`), and the plan was never
updated. The real problem today is not missing content — it is **content that exists but is
unreachable**.

> **Status: the headline finding below was resolved by Phase 4 on 2026-07-26.** The audit is retained
> because it explains why the roadmap is ordered the way it is, and because guideline 5 in
> [Content Creation Guidelines](#content-creation-guidelines) exists to prevent a recurrence.

### The headline finding: `docs/overview/` was orphaned

All five planned overview pages exist on disk:

| File | Lines | In sidebar? |
| --- | --- | --- |
| `docs/overview/what-is-watt.md` | 386 | ✅ Fixed in Phase 4 |
| `docs/overview/getting-started.md` | 277 | ✅ Fixed in Phase 4 |
| `docs/overview/architecture-overview.md` | 566 | ✅ Fixed in Phase 4 |
| `docs/overview/use-cases-and-examples.md` | 430 | ✅ Fixed in Phase 4 |
| `docs/overview/comparison-with-alternatives.md` | 811 | ✅ Fixed in Phase 4 |

`docs/sidebars.js` still exposes only the single legacy page `docs/Overview.md` (104 lines) under the
"Overview" category. Roughly **2,470 lines of strategic content are invisible on the published site.**

Worse, those pages link to routes that do not exist, so even if they were wired up today they would
ship broken navigation:

- `/docs/getting-started/quick-start-watt` → the file is `getting-started/quick-start.md`
- `/docs/reference/watt/` → the real path is `reference/wattpm/`
- `/docs/guides/databases/`, `/docs/guides/frameworks/`, `/docs/guides/integrations/`,
  `/docs/guides/monitoring/`, `/docs/guides/deployment/` → no such index pages exist

**Wiring up and repairing `docs/overview/` is the single highest-value documentation task available.**
It converts already-paid-for work into user-visible value.

### Full orphan list (on disk, absent from `docs/sidebars.js`)

Docs are published to the separate `platformatic/docs` repo via `.github/workflows/update-docs.yml`,
so `docs/sidebars.js` is the **single source of truth for navigation**. A page absent from it is
effectively unpublished.

| Orphan | Disposition |
| --- | --- |
| `overview/what-is-watt` | Wire up (see above) |
| `overview/getting-started` | Wire up — but resolve overlap with `getting-started/quick-start` first |
| `overview/architecture-overview` | Wire up |
| `overview/use-cases-and-examples` | Wire up |
| `overview/comparison-with-alternatives` | Wire up |
| `guides/logging` | Wire up — Phase 2 explicitly enhanced this file, then never linked it |
| `guides/capabilities` | Wire up under How-to Guides (linked from `guides.md` index only) |
| `guides/frameworks` | Wire up under How-to Guides (linked from `guides.md` index only) |
| `guides/cli-managing` | Wire up under How-to Guides (linked from `guides.md` index only) |
| `guides/opentelemetry-sdk-setup` | Wire up under Monitoring & Observability |
| `reference/wattpm/reference` | Merge into `reference/wattpm/cli-commands` (overlapping content) or wire up |
| `getting-started/issues` | Intentional — MDX partial, imported via `import Issues from ...`. Leave out. |
| `getting-started/new-api-project-instructions` | Verify whether still used as a partial; delete if dead. |

Note: `docs/guides.md` (the How-to Guides index page) *does* link several of these, so they are
reachable by clicking through, but they never appear in the sidebar tree.

### Terminology and product drift the plan had not absorbed

1. **Composer → Gateway.** `packages/gateway` now exists and docs live at `docs/reference/gateway/`.
   The old plan referred to "Composer Service" throughout. Both `packages/composer` and
   `packages/gateway` are present in the workspace, so docs must be explicit about which is current.
2. **Services → Applications.** Runtime docs now consistently say "applications" for the units running
   inside Watt (`reference/runtime/overview.md`). The old plan's "services that run within Watt"
   phrasing is off-message.
3. **Capability set has more than doubled.** The plan's reference tree listed only `next`, `astro`,
   `node`. Shipped today: `astro`, `nest`, `next`, `nitro`, `node`, `nuxt`, `react-router`, `remix`,
   `tanstack`, `vite`.

### Items from the previous plan that are now obsolete

- **"Split the Monitoring and Observability guide"** — moot. `docs/guides/monitoring-and-observability.md`
  was deleted, and `docs/guides/monitoring.md` was renamed to `docs/guides/metrics.md`. Observability
  is now covered by a set of focused guides (`metrics`, `distributed-tracing`, `logging`,
  `logging-to-elasticsearch`, `opentelemetry-logging`, `opentelemetry-sdk-setup`,
  `profiling-with-watt`, `heap-snapshots`, `capture-flamegraphs-on-health-events`,
  `debugging-with-repl`). **Drop this requirement.**
- **"Multiple competing getting-started paths"** — partially resolved.
  `docs/getting-started/quick-start-guide.md` was deleted. One overlap remains (below).
- **"Move `docs/packages/` to `docs/reference/`"** — done.
- **"Team Structure Suggestions" (Tutorial Specialist / Technical Writer / …)** — never actionable for
  this repo. **Dropped.**

### Remaining structural problems

1. **Two competing "getting started" entry points.** `docs/getting-started/quick-start.md` (327 lines,
   hands-on: Node app → Gateway → Next.js → build/debug) vs `docs/overview/getting-started.md` (277
   lines, a path-chooser with decision tree and success criteria). These serve different Diátaxis
   purposes and both are useful — but they need explicit cross-linking and distinct titles, or users
   will land on the wrong one.
2. **The Explanation quadrant does not exist.** There is no `docs/concepts/`. Explanation-type content
   is scattered across `guides/watt-architecture-patterns.md`,
   `reference/runtime/multithread-architecture.md`, and `overview/architecture-overview.md` —
   i.e. filed under How-to and Reference, violating Diátaxis separation.
3. **`docs/learn/` never grew.** It still contains exactly two beginner tutorials
   (`crud-application`, `environment-variables`). The planned `quick-start/`, `tutorials/`,
   `examples/`, and `migrations/` subtrees do not exist. Every migration guide the plan called for
   (Express, Fastify, monolith) is still missing — while `getting-started/port-your-app.md` covers
   some of that ground and should be the seed for it.
4. **`docs/Overview.md` vs `docs/overview/what-is-watt.md`** are near-duplicates in intent. Pick one
   as the canonical landing page.
5. **TypeScript compilation guide split** — never done; `docs/guides/deployment/compiling-typescript.md`
   remains a single file. Re-evaluate whether the split is still worth it (see Phase 6).

---

## Revised Roadmap

Phases 1 and 2 are complete and are archived at the bottom of this document. Phase 3 is complete on
disk but undelivered to users. The work below is ordered by value per unit of effort.

### Phase 4: Deliver What Already Exists ✅ COMPLETED (2026-07-26)

**Effort: low. Value: very high.** No new prose required; this was wiring and link repair.

- [x] **Repaired links in `docs/overview/*.md`**
  - [x] `/docs/getting-started/quick-start-watt` → `/docs/getting-started/quick-start`
  - [x] `/docs/reference/watt/` → `/docs/reference/wattpm/overview`
  - [x] Replaced the five nonexistent `/docs/guides/<topic>/` directory links with real targets
- [x] **Added `docs/overview/` to `docs/sidebars.js`**
  - [x] Overview category now: `Overview` (landing), `overview/what-is-watt`,
        `overview/architecture-overview`, `overview/use-cases-and-examples`,
        `overview/comparison-with-alternatives`
  - [x] `overview/getting-started` placed at the top of Getting Started as the path chooser
  - [x] `collapsed: false` retained on both
- [x] **Wired up the orphaned guides** — `guides/logging` and `guides/opentelemetry-sdk-setup` into
      Monitoring & Observability; `guides/capabilities` and `guides/frameworks` into Application
      Development; `guides/cli-managing` into Deployment & Operations
- [x] **Resolved the duplicate CLI reference** — `reference/wattpm/reference.md` (263 lines) deleted;
      `reference/wattpm/cli-commands.md` (817 lines) covers every command it documented plus `repl`,
      `pprof`, `heap-snapshot`, global options, and common workflows. `wattpm/overview.md` repointed.
- [x] **Resolved `docs/Overview.md` vs `docs/overview/what-is-watt.md`** — kept both, with distinct
      roles made explicit: `Overview.md` is the short landing/routing page and now links into the
      Overview section; `what-is-watt.md` is the progressive-depth explainer. Also removed a
      duplicated "What You Can Build" section from `Overview.md`.
- [x] **Confirmed `getting-started/new-api-project-instructions.md` is a live MDX partial**
      (imported by `learn/beginner/crud-application.md` and
      `guides/generate-frontend-code-to-consume-platformatic-rest-api.md`) — correctly excluded
      from the sidebar, as is `getting-started/issues.md`

**Beyond the original scope**, the link audit surfaced and fixed pre-existing breakage elsewhere:

- 11 dead `/docs/guides/<category>/` links across `cache-with-platformatic-watt`,
  `using-watt-with-node-config`, `use-watt-multiple-repository`, `environment-variables`, and
  `k8s-readiness-liveness` — all "Next Steps" sections pointing at guide categories that were
  planned in this document but never created
- `/docs/reference/gateway/introduction` → `overview` (in `getting-started/quick-start.md`)
- `/docs/reference/db/authorization/introduction` → `overview`, and `/docs/guides/jwt-auth0` →
  `/docs/reference/db/jwt-auth0` (in `securing-platformatic-db.md`)
- `reference/gateway/overview.md` pointed at `../watt/overview.md`, which never existed
- `docs.platformatic.dev/docs/reference/{runtime,db}/introduction` self-links in
  `build-modular-monolith.md`, converted to working relative routes
- Four commented-out "Related Tutorials" links in `crud-application.md` restored as working links to
  targets that exist today

**Exit criteria met.** Verified mechanically:

- Every non-partial `.md` under `docs/` appears in `docs/sidebars.js` (128 files on disk, 126
  sidebar entries, difference = the 2 MDX partials)
- Zero broken sidebar references
- Zero broken absolute `/docs/…` links, relative `.md` links, or `docs.platformatic.dev` self-links

**Follow-up completed (code):** the audit found that package code also emits documentation URLs, and
eight of them 404'd. All source occurrences were repointed:

| Emitted URL | Now points to | Source |
| --- | --- | --- |
| `guides/debug-platformatic-db` | `reference/troubleshooting#database-connection-issues` | `db/lib/application.js` |
| `db/configuration` | `reference/db/configuration` | `wattpm-utils`, 4 × `db/lib/commands/` |
| `application/configuration` | `reference/service/configuration` | `wattpm-utils/lib/commands/external.js` |
| `db/overview` | `reference/db/overview` | `db/lib/templates.js` (generated README) |
| `gateway/overview` | `reference/gateway/overview` | `gateway/lib/generator.js` (generated README) |
| `service/overview` | `reference/service/overview` | `service/lib/generator.js` (generated README) |

Most were simply missing the `reference/` path segment. Three stale URLs remain in
`packages/*/test/fixtures/` — inert recorded data, deliberately left alone.

**Lesson to carry forward:** documentation URLs are emitted from product code, not just written in
`docs/`. Any future docs reorganisation must grep `packages/` for `docs.platformatic.dev` before
moving or renaming a page, otherwise CLI warnings and generated READMEs start pointing at 404s.

### Phase 5: Terminology and Accuracy Pass 🟡 IN PROGRESS

**Effort: medium. Value: high.** Users currently hit contradictory names for the same thing.

- [x] **Composer → Gateway** ✅ 2026-07-27. Gateway is now the product name everywhere in prose,
      headings, config keys, example directories and internal hostnames. Composer survives only
      where it is factually required:
  - A `:::info[Previously called Composer]` note on `reference/gateway/overview.md` recording that
    the product was Composer through the v1 and v2 lines, was renamed in **v3.0.0**, that
    `@platformatic/composer` remains a deprecated alias in v3, and that it is removed in v4.0.0 —
    with the three-step migration (dependency, `$schema`, config key)
  - `reference/runtime/programmatic.md`, which legitimately documents `composer` as an accepted
    application type; the mentions are kept but annotated as a deprecated alias rather than deleted,
    because removing them would make the page wrong
  - `packages/composer/README.md`, which now carries an explicit deprecation banner
  - Two things that must never be renamed and were deliberately left alone: PHP's `composer.json`
    in `guides/use-watt-with-ai-agents.md`, and the external `graphql-composer` package in
    `reference/gateway/configuration.md`

  The rename also reached `README.md`, `CONTRIBUTING.md` and `CLAUDE.md`.

  **Config-shape bugs found and fixed while renaming** — these were broken independently of
  terminology, and validating the examples against `packages/gateway/schema.json` proved it:
  - `guides/cache-with-platformatic-watt.md` used `gateway.services[].prefix`. The schema declares
    `additionalProperties: false`, exposes `applications` (not `services`), and puts `prefix` inside
    `proxy`. The example could never have validated. Corrected and verified against the real schema.
  - `guides/logger/` had the same `services`-instead-of-`applications` error, and its runtime
    config set `autoload.path: "applications"` while the directory on disk was `services/` — so the
    checked-in example did not run. Directory renamed to `applications/`, and `composer/` within it
    to `gateway/`.
  - `guides/cache-with-platformatic-watt.md` had two sections both numbered "Step 4"; renumbered.
- [x] **Services → Applications** ✅ 2026-07-28. The CLI is fully migrated (`wattpm applications`,
      "Builds all applications of the project"), so the docs were the laggard. Changed:
  - Every legacy runtime config key in examples — `"services": []` and `"web": []` → `"applications": []`.
    All three keys are still concatenated by `runtime/lib/config.js`, so the old ones are not broken,
    but `applications` is the current name. Each migrated example was validated against
    `packages/runtime/schema.json`.
  - Sidebar labels: `Services & APIs` → `Applications & APIs`, `HTTP Service` → `HTTP Application`,
    `Database Service` → `Database Application`. Also caught `API Gateway (Composer)`, a leftover the
    previous pass missed.
  - Reference headings: `# HTTP Service` → `# HTTP Application`, `# Database Service` →
    `# Database Application`, `# API Gateway (Gateway Service)` → `# API Gateway`, and the "Gateway
    Service" prose throughout `reference/gateway/overview.md`.
  - **Deliberately left alone:** "microservices", "service discovery", "service mesh",
    "service-to-service", and references to external/non-Node services. These are industry terms in
    passages comparing Watt to other architectures, not names for the units running inside Watt.
    A blanket rename would have mangled them.
  - Fixed a regression from the previous PR: `guides/logging.md` still showed
    `"autoload": { "path": "services" }` after the logger example directory was renamed to
    `applications/`, so the snippet contradicted the checked-in example.
- [x] **Complete the capability coverage** ✅ 2026-07-28. `guides/frameworks.md` already listed all
      ten; `guides/capabilities.md` was missing React Router and TanStack, now added. The framework
      lists in `Overview.md`, `overview/what-is-watt.md`, `overview/comparison-with-alternatives.md`
      and `README.md` named four or five and are now complete. Note `Overview.md` previously claimed
      integration with "React, Vue" — neither is a capability — which is now corrected.
- [~] **Verify tutorials run end-to-end** — partially done, and it found real bugs. See below.

#### Tutorial verification results (2026-07-28)

`getting-started/quick-start.md` was executed against Watt 3.64.0 on Node 24.14.1, driving the
interactive generator through `PLT_USER_INPUT_HANDLER` so the real prompts could be captured.

**Verified working:** project creation, the generated `web/node/index.js` (matches the documented
snippet exactly), `npm start`, and `curl localhost:3042` → `{"hello":"world"}`. Then the Gateway step:
creation, and `curl localhost:3042/node` → `{"hello":"world"}` routed through the gateway. The
documented gateway config shape (`gateway.applications[].proxy.prefix`) is correct.

**Fixed:** three transcript inaccuracies. The first run's transcript was missing the
`Do you want to init the git repository?` prompt; the second run's was missing
`Which package manager do you want to use?`; and both hard-coded version `3.0.0`, now genericised so
the transcript does not go stale on every release.

**Found — a real bug, now documented:** `npx create-next-app web/next` names the generated workspace
package `next`. Because a Watt project sets `"workspaces": ["web/*"]`, npm links `node_modules/next`
to `web/next`, and that symlink shadows the Next.js framework. Confirmed directly:
`node_modules/next -> ../web/next`, and resolving `next` from the project root returned the
application (version `0.1.0`) rather than Next.js `16.2.12`. The dev server then fails with dozens of
`Module not found: Can't resolve 'react'` / `@swc/helpers` errors. This reproduces **outside Watt** —
running `npx next dev` directly in `web/next` fails identically — so it is a naming collision, not a
runtime bug. A `:::caution` block in the tutorial now explains it and the remedy.

**Found — a second, independent bug, now documented:** with the name collision avoided, the `next`
worker still exited with code 1 and no diagnostic output. Running Next's dev binary directly with
stderr captured produced the real error, which the runtime was swallowing:

```
Next.js inferred your workspace root, but it may not be correct.
We couldn't find the Next.js package (next/package.json) from the project directory
```

Next.js 16 builds with Turbopack by default. Turbopack infers a workspace root, and because npm
workspaces hoists `next` to the Watt project root it cannot resolve `next/package.json` from the
application directory. Setting `turbopack.root` to the Watt project root fixes it. Verified: before,
five consecutive `exited prematurely with error code 1` retries; after, `Started the worker 0` plus
`✓ Ready`, and `GET /` through Watt returns **200** with ~16KB of rendered Next.js markup. This also
reproduces with plain `next dev` outside Watt, so like the name collision it is an npm workspace
resolution problem rather than a Watt runtime bug.

**The Next.js half of the quick start is now verified working end to end** with both adjustments
documented in a `:::caution` block.

**Worth a product follow-up (not a docs fix):** the runtime reported only
`exited prematurely with error code 1` with no stderr from the child, even at
`PLT_SERVER_LOGGER_LEVEL=trace`. The underlying Next.js error was recoverable only by bypassing Watt
and running the binary directly. Surfacing child stderr on a startup failure would have made this
diagnosable in seconds rather than requiring a bisect.

**Not attempted:** `learn/beginner/crud-application.md`, which needs a database.

### Phase 6: Fill the Diátaxis Gaps 🟢 MEDIUM

**Effort: high. Value: medium — do not start before Phases 4 and 5.**

- [ ] **Create `docs/concepts/`** (the missing Explanation quadrant) and relocate/derive:
  - [ ] `concepts/watt-architecture.md` — seed from `overview/architecture-overview.md` and
        `guides/watt-architecture-patterns.md`
  - [ ] `concepts/multithread-model.md` — seed from `reference/runtime/multithread-architecture.md`
  - [ ] `concepts/application-lifecycle.md`
  - [ ] `concepts/modular-monolith.md` — the positioning the README already leads with
- [ ] **Grow `docs/learn/`**
  - [ ] `learn/migrations/from-express.md`, `from-fastify.md` — seed from
        `getting-started/port-your-app.md`
  - [ ] Example gallery, if and only if the examples are CI-tested; an untested example gallery is a
        net negative
- [ ] **Re-evaluate the TypeScript guide split.** The original rationale (separating plain Node.js
      compilation from `plt service compile` / `plt runtime compile`) may no longer hold given
      current tooling. Confirm the commands still exist before splitting.

### Explicitly Not Doing

- Splitting the monitoring/observability guide — the file no longer exists.
- The success-metrics dashboard (bounce rates, completion rates, analytics tracking) from the
  original plan. This repo has no analytics pipeline; these were aspirational and unmeasurable.
- Assigning named documentation roles.

---

## Target Structure (Revised)

Reflects current package names and shipped capabilities.

```
docs/
├── Overview.md                        # Canonical landing page
├── overview/                          # Discovery & orientation  [EXISTS, ORPHANED]
│   ├── what-is-watt.md
│   ├── getting-started.md             # Path chooser
│   ├── architecture-overview.md
│   ├── use-cases-and-examples.md
│   └── comparison-with-alternatives.md
├── getting-started/                   # Hands-on entry
│   ├── quick-start.md
│   └── port-your-app.md
├── learn/                             # Tutorials  [THIN — 2 files]
│   ├── beginner/
│   └── migrations/                    # [MISSING]
├── guides/                            # How-to  [HEALTHY]
│   ├── deployment/
│   └── ...
├── reference/                         # Information-oriented  [HEALTHY]
│   ├── wattpm/                        # Watt — primary product
│   ├── runtime/
│   ├── service/  gateway/  db/        # Applications
│   ├── astro/ nest/ next/ nitro/ node/ nuxt/
│   │   react-router/ remix/ tanstack/ vite/   # Capabilities
│   └── sql-mapper/ sql-graphql/ sql-openapi/ sql-events/
└── concepts/                          # Explanation  [MISSING ENTIRELY]
```

---

## Strategic Foundation (Unchanged — Still Valid)

The positioning and user-journey analysis below has held up well and continues to guide content
decisions. It is retained verbatim in intent from the original plan.

### Strategic Focus

**Watt (wattpm) is the primary product** — the Node.js Application Server that powers everything else.
Other components (DB, Service, Gateway, Runtime) are applications and features that run within Watt.

### User Types and Entry Points

**1. New Node.js Developers**

- **Entry Point**: Landing page → "What is Watt?" → Quick Start Tutorial
- **Success Criteria**: Can build and deploy a simple API within 30 minutes
- **Journey**: Overview → Tutorial → How-to Guides → Reference

**2. Experienced Node.js Developers**

- **Entry Point**: README → Architecture Overview → Migration Guide
- **Success Criteria**: Can migrate an existing project or build a complex app within 2 hours
- **Journey**: Overview → Comparison → How-to Guides → Reference → Concepts

**3. Teams Migrating from Other Platforms**

- **Entry Point**: Landing page → "Why Watt?" → Architecture Comparison
- **Success Criteria**: Team can evaluate and pilot Watt for production use
- **Journey**: Overview → Concepts → Migration Guides → Advanced How-tos

**4. Platform/DevOps Engineers**

- **Entry Point**: Documentation → Deployment Guides → Monitoring Setup
- **Success Criteria**: Can deploy and monitor Watt applications in production
- **Journey**: Architecture Overview → Deployment How-tos → Advanced Configuration

### Critical Decision Points

| Stage | Question | Content required | Status |
| --- | --- | --- | --- |
| Discovery | "Should I use Watt?" | Value prop, comparison matrix | ✅ Written, ❌ orphaned |
| Evaluation | "How do I get started?" | Multi-path entry, time estimates | ✅ Written, ❌ orphaned |
| Implementation | "Can this work for my project?" | Integration guides, compatibility | ✅ Largely covered |
| Adoption | "How do I use this in production?" | Deployment, monitoring, scaling | ✅ Strong coverage |

The pattern is clear: **discovery and evaluation content exists but is unreachable, while
implementation and adoption content is well served.** Phase 4 closes exactly this gap.

### Multi-Path Entry Strategy

**Path 1: Quick Start (5–10 min)** — immediate results via `npx wattpm create`, running app with
endpoints, then pointed at a full tutorial or integration guide.

**Path 2: Guided Tutorial (30 min)** — step-by-step learning producing both conceptual understanding
and a working application.

**Path 3: Example-Driven (15–20 min)** — a gallery of complete, runnable examples for developers who
learn from working reference implementations.

**Path 4: Migration-Focused (45–60 min)** — for teams with existing Express/Fastify/monolith
applications.

Paths 1, 2, and 4 have real content today (`getting-started/quick-start.md`,
`learn/beginner/crud-application.md`, `getting-started/port-your-app.md`). Path 3 does not.

### Content Creation Guidelines

1. **Tutorials must work reliably** — test every step against the current release
2. **How-to guides solve real problems** — derived from actual user questions
3. **Reference is accurate and current** — auto-generated where possible
4. **Explanations provide context** — why, not just what
5. **Nothing ships unlinked** — if it is not in `docs/sidebars.js`, it does not exist

Guideline 5 is new, and is the direct lesson of the Phase 3 regression.

---

## Archive: Completed Phases

### Phase 1: Foundation ✅ COMPLETED

- [x] Root README rewritten with Watt-first positioning and clear entry paths
- [x] `docs/sidebars.js` reorganized from package-centric to user-journey-centric
- [x] `docs/packages/` moved to `docs/reference/`, grouped by user mental model
- [x] Getting-started content consolidated; `quick-start-guide.md` removed

### Phase 2: Content Enhancement ✅ COMPLETED (December 2024, PR #4183)

- [x] CRUD tutorial restructured to Watt-first positioning with learning objectives and time estimates
- [x] Environment-variables tutorial rewritten to Diátaxis tutorial principles
- [x] Deployment guides enhanced with problem–solution structure
      (`dockerize-a-watt-app`, `compiling-typescript`, `k8s-readiness-liveness`)
- [x] Watt guides enhanced (`cache-with-platformatic-watt`, `use-watt-multiple-repository`,
      `using-watt-with-node-config`)
- [x] `docs/guides/logging.md` reorganized by use case — *note: still not in the sidebar, see Phase 4*
- [x] `docs/reference/wattpm/cli-commands.md` created, unifying wattpm and platformatic commands
- [x] `docs/reference/troubleshooting.md` created
- [x] Service overviews repositioned as components within Watt

### Phase 3: Strategic New Content ✅ COMPLETED ON DISK (PR #4275) / ❌ NOT DELIVERED

All five `docs/overview/` pages were authored and merged. **They were never added to
`docs/sidebars.js` and their internal links were never validated**, so no user has seen them.
Phase 4 exists to finish the delivery.

---

_This plan positions Platformatic around Watt as the core Node.js Application Server, following the
Diátaxis framework. As of the 2026-07-26 audit, the binding constraint is not content creation but
content delivery: the highest-value work is making existing, already-written documentation reachable._
