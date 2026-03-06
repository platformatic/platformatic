# Security Policy

This document describes the management of vulnerabilities for the
Platformatic project and all its packages.

## Threat Model

Platformatic's threat model extends the
[Node.js security policy](https://github.com/nodejs/node/blob/main/SECURITY.md)
and the
[Fastify security policy](https://github.com/fastify/fastify/blob/main/SECURITY.md).

**Trusted:**

- Application code (plugins, handlers, hooks, schemas, custom modules)
- Configuration files and environment variables
- The runtime environment and the operating system
- The build environment and development tooling
- The database and everything it returns (connection strings, schema,
  query results, metadata)
- Database schema definitions and migration files

**Untrusted:**

- All inbound network input (HTTP headers, body, query strings, URL
  parameters, WebSocket messages)
- GraphQL queries and variables from clients

Platformatic assumes Node.js is running with `insecureHTTPParser: false`
(the secure default). Deployments that enable `insecureHTTPParser: true`
are outside Platformatic's threat model.

### Prototype Pollution

If any Platformatic code **causes** prototype pollution when processing
untrusted input, that is considered a vulnerability.

However, vulnerabilities that **require** a pre-existing prototype
pollution (i.e. `Object.prototype` has already been tampered with by
other code) are **not** considered vulnerabilities in Platformatic.
Application code and third-party dependencies are trusted; it is the
application's responsibility to avoid introducing prototype pollution
into its own process.

---

## Module Threat Models

The following sections describe the threat model for each group of
packages in the Platformatic monorepo. For every group we list what is
trusted, what is untrusted, and where the **API boundary** lies (i.e.
where users are responsible for validation).

### Core Runtime and Orchestration

**Packages:** `runtime`, `foundation`, `itc`, `wattpm`, `control`, `basic`, `cli`

The runtime starts and manages application workers, exposes a management
API, loads configuration, and provides inter-thread communication.

**Trusted:**

- Configuration files (JSON, JSON5, YAML, TOML) and the environment
  variables referenced within them.
- JavaScript/TypeScript modules loaded via `loadModule()` in
  `foundation`. The runtime trusts whatever code the operator points it
  to.
- The management API socket path and its filesystem permissions. The
  management API listens on a Unix socket (or Windows named pipe) and
  relies on OS-level access control. Any process that can connect to the
  socket is considered trusted.
- CLI arguments.

**Untrusted:**

- HTTP requests arriving at application workers via the network.

**API boundaries (user responsibility):**

- Protecting the management API socket with appropriate filesystem
  permissions. The management API exposes powerful operations (stop,
  restart, environment variable listing, REPL access, request proxying)
  and has no built-in authentication.
- Ensuring that environment variables referenced in configuration do not
  contain sensitive values that would be unsafe to interpolate into the
  resulting configuration object.
- Restricting access to the Prometheus metrics endpoint when HTTP Basic
  Authentication is not configured.

### Database and SQL

**Packages:** `db`, `db-core`, `sql-mapper`, `sql-openapi`, `sql-graphql`,
`sql-events`, `sql-json-schema-mapper`

These packages introspect SQL databases, map tables to entities, and
auto-generate REST and GraphQL CRUD APIs with parameterized queries.

**Trusted:**

- Database connection strings and credentials (provided via
  configuration / environment variables).
- The database itself: schema, query results, metadata, and all data
  returned by the database engine. The database is a trusted component.
- Entity definitions and field mappings produced by schema introspection.
- SQL migration files.

**Untrusted:**

- HTTP request parameters that flow into `where` clauses, field
  selection, pagination (`limit`, `offset`), and create/update request
  bodies via the auto-generated REST and GraphQL APIs.
- GraphQL queries, mutations, variables, and subscriptions received from
  clients.

**Security controls:**

- All user-supplied values are passed through parameterized queries via
  `@databases/sql` tagged template literals (`sql.value()` for values,
  `sql.ident()` for identifiers). SQL injection through values is
  prevented by this mechanism.
- Comparison operators in `where` clauses are drawn from a hardcoded
  whitelist (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`,
  `like`, `ilike`, `any`, `all`, `contains`, `contained`, `overlaps`).
  User input never reaches `sql.__dangerous__rawValue()` directly.
- OpenAPI schema validation is applied to REST request/response shapes.
- GraphQL type system validation is applied by Mercurius.
- Unknown fields are rejected with `UnknownFieldError`.

**API boundaries (user responsibility):**

- Writing safe custom SQL in hooks, plugins, or resolvers. Platformatic
  cannot protect against SQL injection in user-authored raw SQL.
- Configuring appropriate authorization rules (see Authorization
  below). Without authorization, the auto-generated APIs expose full
  CRUD access to all mapped tables.
- Restricting `LIKE`/`ILIKE` wildcard patterns if the application
  requires it. Platformatic passes user-supplied `like`/`ilike` values
  as parameterized query values but does not escape the SQL `%` and `_`
  wildcard characters; this is by design to allow pattern matching, but
  applications that need to prevent arbitrary wildcard searches should
  sanitize the input in a hook.

### Authorization

**Package:** `db-authorization`

This package provides role-based access control (RBAC) with optional
row-level security for the auto-generated database APIs.

**Trusted:**

- Authorization rules defined in configuration (role names, entity
  permissions, field restrictions, row-level `checks`).
- The admin secret value (`adminSecret` in configuration).
- JWT signing keys and JWKS endpoints.
- Webhook URLs used for user extraction.

**Untrusted:**

- JWT tokens presented by clients.
- The `X-PLATFORMATIC-ADMIN-SECRET` header value.
- The `X-PLATFORMATIC-ROLE` header (only used when the admin secret is
  provided; otherwise roles are extracted exclusively from the JWT or
  webhook response).
- User properties extracted from JWT claims or webhook responses that
  feed into row-level security WHERE clauses. These are always
  interpolated via parameterized queries.

**API boundaries (user responsibility):**

- Defining correct and complete authorization rules. If no rules are
  configured, all operations are denied by default, but overly
  permissive rules (e.g. granting `find` without field or row
  restrictions) are the application's responsibility.
- Keeping the admin secret confidential. When the correct admin secret
  is presented, the caller is granted the `platformatic-admin` role with
  full access.
- Configuring JWT validation correctly (algorithms, audience, issuer).
  Platformatic delegates JWT verification to `@fastify/jwt`; weak
  configuration is the application's responsibility.
- Securing the authentication webhook endpoint. Platformatic trusts the
  response from the configured webhook URL.

### API Gateway and Composition

**Packages:** `gateway`, `composer`

The gateway proxies HTTP and WebSocket requests to upstream application
services and optionally composes OpenAPI and GraphQL schemas.

**Trusted:**

- Gateway configuration (upstream URLs, route mappings, proxy settings).
- Custom proxy modules loaded from paths specified in configuration.
- OpenAPI and GraphQL schemas fetched from upstream services at startup.

**Untrusted:**

- All proxied HTTP requests and WebSocket messages from clients.
- Response headers from upstream services (to the extent that they are
  rewritten, e.g. `Location` headers).

**Security controls:**

- Proxying is handled by `@fastify/http-proxy`.
- `x-forwarded-for`, `x-forwarded-host`, and `x-forwarded-proto`
  headers are set on proxied requests.
- Per-application HTTP method and route restrictions can be configured.

**API boundaries (user responsibility):**

- Configuring upstream URLs to point to trusted services. The gateway
  will forward requests to whatever upstream is configured.
- Implementing authentication and authorization in upstream services or
  via gateway-level plugins. The gateway does not perform authentication
  by default.
- Reviewing custom proxy modules for security. These modules run with
  the full privileges of the gateway process.

### HTTP Service

**Package:** `service`

The base HTTP service built on Fastify. All other Platformatic services
extend this package.

**Trusted:**

- Service configuration (CORS settings, plugin paths, server options).
- User-supplied Fastify plugins loaded at startup.

**Untrusted:**

- All inbound HTTP requests.

**Security controls:**

- CORS via `@fastify/cors`.
- Back-pressure and overload protection via `@fastify/under-pressure`.
- Health check endpoints.

**API boundaries (user responsibility):**

- Configuring CORS origins correctly. When using regex-based origins in
  configuration, ensure the patterns are not vulnerable to ReDoS. Note
  that CORS configuration is trusted (it comes from the application
  configuration), so this is only a concern if configuration is
  generated from untrusted input.
- Implementing request validation, authentication, and authorization in
  plugins and route handlers. The `service` package provides the HTTP
  framework but does not enforce any application-level security policies.
- Validating all untrusted input in route handlers before passing it to
  Node.js APIs, database queries, or external services.

### Frontend Framework Integrations

**Packages:** `next`, `astro`, `vite`, `remix`, `react-router`,
`tanstack`, `nest`, `node`

These packages integrate frontend frameworks (Next.js, Astro, Vite,
Remix, React Router, TanStack Start, NestJS) and generic Node.js
applications as Platformatic capabilities within the runtime.

**Trusted:**

- Framework configuration and build output.
- Server-side application code.

**Untrusted:**

- HTTP requests handled by the framework's server-side rendering or API
  routes.
- Static file requests.

**Security controls:**

- Static file serving via `@fastify/static`.
- Framework-specific server-side rendering pipelines.
- Request injection via `light-my-request` for frameworks that do not
  natively speak Fastify (NestJS, generic Node.js).

**API boundaries (user responsibility):**

- All application-level security (authentication, authorization, input
  validation, XSS prevention, CSRF protection) within the framework's
  routes and components. Platformatic provides the hosting and
  integration layer but does not add security controls on top of the
  framework's own mechanisms.
- Securing server-side rendering against injection attacks (XSS in
  rendered HTML, SSRF in data fetching).

### Observability

**Packages:** `metrics`, `telemetry`

These packages collect Prometheus metrics and OpenTelemetry traces.

**Trusted:**

- Metrics and telemetry configuration (exporter endpoints, labels).
- The OTLP collector endpoint.

**Untrusted:**

- Trace context headers (`traceparent`, `tracestate`) from inbound
  requests. These are parsed by the OpenTelemetry SDK.

**API boundaries (user responsibility):**

- Restricting access to the metrics endpoint. When exposed without
  authentication, Prometheus metrics may reveal internal service
  topology, request rates, and error patterns.
- Ensuring the OTLP collector endpoint is trusted. Trace data may
  contain request paths, headers, and other potentially sensitive
  information.

### Code Generation and Tooling

**Packages:** `generators`, `create-wattpm`, `create-platformatic`,
`wattpm-utils`

Development-time scaffolding and project creation tools.

**Trusted:**

- User input during interactive project creation.
- npm registry responses when resolving packages.
- Template files and archives downloaded during scaffolding.

These packages run as CLI tools during development and are not part of
the production runtime. They are outside the security threat model for
deployed applications. Vulnerabilities in these packages would only be
relevant if they could lead to the generation of insecure application
code by default.

---

## Examples of Vulnerabilities

- SQL injection through the auto-generated REST or GraphQL APIs that
  bypasses the parameterized query mechanism in `sql-mapper`.
- Prototype pollution caused by Platformatic's own parsing or processing
  of untrusted HTTP input.
- Authentication or authorization bypass in `db-authorization` (e.g.
  accessing data without a valid JWT or admin secret, circumventing
  row-level security checks).
- Request smuggling through the gateway proxy layer.
- Path traversal in static file serving that escapes the configured
  root directory.
- Remote code execution via crafted configuration values or HTTP input
  (when the configuration itself is not attacker-controlled).
- Denial of service through malformed HTTP input to Platformatic's core
  parsing or routing logic (not through user-written handlers).

## Examples of Non-Vulnerabilities

The following are **not** considered vulnerabilities in Platformatic:

- **Application code vulnerabilities**: XSS, SQL injection, or other
  flaws in user-written route handlers, hooks, plugins, or resolvers.
- **Malicious application code**: Issues caused by intentionally
  malicious plugins, handlers, or custom proxy modules (application code
  is trusted).
- **Weak or missing authorization rules**: The auto-generated APIs
  exposing data because the application did not configure adequate
  authorization rules.
- **Validation schema issues**: Weak or incorrect schemas provided by
  developers for request validation.
- **Configuration mistakes**: Security issues arising from developer
  misconfiguration (e.g. exposing the management API socket,
  misconfigured CORS, weak JWT settings).
- **Pre-existing prototype pollution**: Vulnerabilities that require
  `Object.prototype` to have already been polluted by other code before
  Platformatic processes input.
- **ReDoS in user-provided patterns**: Regular expression denial of
  service in user-provided regex patterns for routes, CORS origins, or
  validation (configuration is trusted).
- **Missing security features**: Lack of rate limiting, CSRF protection,
  or other application-level security controls in the base framework.
- **Management API access**: Security issues that require the ability to
  connect to the Unix socket / named pipe (the socket is a trust
  boundary; any process that can reach it is trusted).
- **Third-party dependencies**: Vulnerabilities in npm packages used by
  the application (not Platformatic core dependencies).
- **Resource exhaustion from handlers**: Denial of service caused by
  expensive operations in user route handlers or resolvers.
- **`insecureHTTPParser: true` deployments**: Reports that rely on
  enabling Node.js `insecureHTTPParser` are out of scope.
- **Development tooling issues**: Vulnerabilities in code generation
  or scaffolding tools that do not affect production deployments.
- **Database-level issues**: Vulnerabilities in the underlying database
  engine (PostgreSQL, MySQL, MariaDB, SQLite). The database is a trusted
  component.
- **Data returned by the database**: The database and all data it
  returns are trusted. Issues that require a compromised or malicious
  database are out of scope.

---

## Reporting Vulnerabilities

Individuals who find potential vulnerabilities in Platformatic are
invited to complete a vulnerability report via the
[GitHub Security page](https://github.com/platformatic/platformatic/security/advisories/new).

Do not assign or request a CVE directly.
CVE assignment is handled by the Platformatic Security Team.

### Strict measures when reporting vulnerabilities

Please follow these guidelines carefully:

- Only create reports for actual vulnerabilities. Third-party vendors
  and individuals track new vulnerability reports on GitHub and will
  flag them for their customers (e.g. Snyk, npm audit). Avoid creating
  "informative" reports that are not genuine vulnerabilities.
- Security reports should never be created and triaged by the same
  person. If you are creating a report for a vulnerability that you
  found, there should always be a second Security Team member who
  triages it.
- **Do not** attempt to demonstrate CI/CD vulnerabilities by creating
  pull requests to any Platformatic organization repository. The proper
  way is to create your own repository configured in the same manner
  and demonstrate the proof of concept there.

### Vulnerabilities found outside this process

The Platformatic project does not support any reporting outside the
process mentioned in this document.

## Handling Vulnerability Reports

When a potential vulnerability is reported, the following actions are
taken:

### Triage

**Delay:** 4 business days

Within 4 business days, a member of the security team provides a first
answer to the individual who submitted the potential vulnerability. The
possible responses are:

- **Acceptance**: what was reported is considered as a new vulnerability.
- **Rejection**: what was reported is not considered as a new
  vulnerability.
- **Need more information**: the security team needs more information in
  order to evaluate what was reported.

### Correction Follow-Up

**Delay:** 90 days

When a vulnerability is confirmed, a member of the security team
volunteers to follow up on the report. With the help of the individual
who reported the vulnerability, they develop and test a fix.

The report's vulnerable versions upper limit should be set to:
- `*` if there is no fixed version available by the time of publishing.
- The last vulnerable version (e.g. `<=1.2.3` if a fix exists in
  `1.2.4`).

### Publication

**Delay:** 90 days

Within 90 days after the triage date, the vulnerability must be made
public.

**Severity**: Vulnerability severity is assessed using
[CVSS v3](https://www.first.org/cvss/user-guide).

If a fix is actively being developed, an additional delay can be added
with the approval of the security team and the individual who reported
the vulnerability.

## The Platformatic Security Team

The core team is responsible for the management of the security program
and this policy.

Members of this team are expected to keep all information that they have
privileged access to completely private to the team. This includes
agreeing to not notify anyone outside the team of issues that have not
yet been disclosed publicly, including the existence of issues,
expectations of upcoming releases, and patching of any issues other than
in the process of their work as a member of the security team.

### Members

- [__Matteo Collina__](https://github.com/mcollina)
- [__Luca Maraschi__](https://github.com/lucamaraschi)
- [__Paolo Insogna__](https://github.com/ShogunPanda)
