## Capabilities

Capabilities are the building blocks of Platformatic Watt applications. Each capability is a specialized package that provides specific functionality and integrates seamlessly with the Watt runtime environment.

### How Capabilities Work

A capability is essentially a Node.js package that implements the Platformatic capability interface. When you create a Watt project, you choose one or more capabilities that define what your application can do:

- **Single Capability Applications**: Simple applications with one primary function (e.g., a Next.js frontend or a database API)
- **Multi-Capability Applications**: Complex applications that combine multiple capabilities (e.g., a database backend with a React frontend and an API gateway)

Each Watt project can define a set of applications, each using its own capability, by declaring them in the root `watt.config.ts` via the [autoload](../reference/runtime/configuration.md#autoload) or the [applications](../reference/runtime/configuration.md#applications) properties.

Each application gets its own folder, and the capability is the one the application's own `watt.config.ts` imports and calls.

For instance, to use `@platformatic/next`:

```ts config
import { createNextConfig } from '@platformatic/next'

export default createNextConfig({
  server: { port: Number(process.env.PORT ?? 3042) }
})
```

If the application has no configuration file, Watt autodetects the capability from the dependencies in its `package.json`.

#### Role of Configuration Files

The `watt.config.ts` configuration file serves as the authoritative source for:

- **Service Definition**: Explicitly specifies which capability to use (e.g., `@platformatic/next`, `@platformatic/db`)
- **Application Entry Point**: Points to your application's main file or build output directory
- **Runtime Configuration**: Defines port, environment variables, and capability-specific settings
- **Service Dependencies**: Describes how the service connects to other services in multi-capability applications
- **Override Behavior**: Takes precedence over automatic detection, allowing manual control over capability selection

This configuration-first approach ensures predictable behavior and allows developers to override automatic detection when needed.

#### Orchestration lives in the runtime configuration

An application's own file configures the capability and nothing else. Workers, logging, health checks
and the rest are orchestration, and they belong to the runtime configuration — in a single-application
project, alongside the `application` shorthand:

```ts config
import { createWattConfig } from 'wattpm'
import { createNextConfig } from '@platformatic/next'

export default createWattConfig({
  logger: { level: 'debug' },
  workers: { dynamic: true, minimum: 1, maximum: 4 },
  application: {
    config: createNextConfig({
      server: { port: Number(process.env.PORT ?? 3042) }
    })
  }
})
```

These settings do not live under a `runtime` property inside the application's own file; see [Runtime settings for a single application](../reference/next/configuration.md#runtime-settings-for-a-single-application).

#### Where the capability package must be resolvable from

A capability factory called from an application's own `watt.config.*` (the usual, per-application
style) resolves the same way any other import from that file does — the capability just needs to be
a dependency of that application, exactly as before.

When an application's own `watt.config.*` imports a capability, resolution checks the
application's own dependencies first and falls back to the copy bundled with Watt. Under a
hoisted dependency tree, an application that vendors its own copy of a capability the root also
depends on gets its own copy, not the root's.

Calling the factory **inline at the root**, as in the example above, is different: the import runs
from the root configuration file, so the capability package must be resolvable from the *root*
`package.json`. Under a strict dependency layout (for example pnpm), an application-local-only
dependency is not visible from the root, and the loader reports it with a targeted error:

```output
✗ Cannot resolve '@platformatic/next' from watt.config.ts.
  Add it to the root package.json, or configure the application in
  web/frontend/watt.config.ts instead.
```

### Available Capabilities

#### Generic Integrations

##### [`@platformatic/node`](../reference/node/overview.md)

- **Description**: Generic Node.js capability
- **Use Case**: For standard Node.js applications that need integration with the Watt runtime
- **Features**: Basic HTTP server functionality, environment variable management, process management

##### [`@platformatic/gateway`](../reference/gateway/overview.md)

- **Description**: API gateway for aggregating services
- **Use Case**: Composing multiple services into a unified API, routing, and service orchestration
- **Features**: Service discovery, request routing, API composition, load balancing

#### Frontend Framework Integrations

##### [`@platformatic/next`](../reference/next/overview.md)

- **Description**: Next.js application integration
- **Use Case**: Server-side rendered React applications, static site generation
- **Features**: SSR/SSG support, API routes, file-based routing, optimization

##### [`@platformatic/nuxt`](../reference/nuxt/overview.md)

- **Description**: Nuxt application integration
- **Use Case**: Full-stack Vue applications with server-side rendering and static generation
- **Features**: Nuxt development server, Nitro production output, Vite-powered development

##### [`@platformatic/nitro`](../reference/nitro/overview.md)

- **Description**: Nitro application integration
- **Use Case**: Standalone Nitro applications and Vite applications using the Nitro plugin
- **Features**: Nitro development server, Vite-powered development, Nitro production output

##### [`@platformatic/vite`](../reference/vite/overview.md)

- **Description**: Vite-based application support
- **Use Case**: Modern frontend applications with fast development server
- **Features**: Hot module replacement, build optimization, plugin ecosystem

##### [`@platformatic/astro`](../reference/astro/overview.md)

- **Description**: Astro framework integration
- **Use Case**: Content-focused websites, static site generation with islands architecture
- **Features**: Component islands, multiple framework support, static generation

##### [`@platformatic/remix`](../reference/remix/overview.md)

- **Description**: Remix framework integration
- **Use Case**: Full-stack web applications with focus on web standards
- **Features**: Nested routing, data loading, form handling, progressive enhancement

##### [`@platformatic/react-router`](../reference/react-router/overview.md)

- **Description**: React Router application integration
- **Use Case**: React applications built on React Router, run unmodified as a Watt application
- **Features**: Nested routing, data loading, server-side rendering, Vite-powered development

##### [`@platformatic/tanstack`](../reference/tanstack/overview.md)

- **Description**: TanStack Start application integration
- **Use Case**: Full-stack React applications built with TanStack Start, run unmodified as a Watt application
- **Features**: Type-safe routing, server functions, streaming SSR, Vite-powered development

##### [`@platformatic/nest`](../reference/nest/overview.md)

- **Description**: NestJS framework integration
- **Use Case**: Scalable Node.js server-side applications with TypeScript
- **Features**: Dependency injection, decorators, modular architecture

#### Additional Capabilities

##### [`@platformatic/service`](../reference/service/overview.md)

- **Description**: HTTP service based on Fastify
- **Use Case**: Building high-performance REST APIs and web services
- **Features**: Auto-generated OpenAPI documentation, plugin system, validation, serialization

##### [`@platformatic/db`](../reference/db/overview.md)

- **Description**: Database service with auto-generated APIs
- **Use Case**: Rapid API development with automatic CRUD operations from database schema
- **Features**: Auto-generated GraphQL/REST endpoints, migrations, seeds, authorization

##### [`@platformatic/php`](https://github.com/platformatic/php)

- **Description**: PHP application support
- **Use Case**: Integrating PHP applications into the Watt ecosystem
- **Features**: PHP process management, HTTP integration

##### [`@platformatic/ai-warp`](https://github.com/platformatic/ai-warp)

- **Description**: AI integration capabilities
- **Use Case**: Adding AI/ML functionality to applications
- **Features**: AI service integration, model management

##### [`@platformatic/pg-hooks`](https://github.com/platformatic/pg-hooks)

- **Description**: PostgreSQL hooks
- **Use Case**: Database event handling and triggers
- **Features**: Database event listening, hook management

##### [`@platformatic/rabbitmq-hooks`](https://github.com/platformatic/rabbitmq-hooks)

- **Description**: RabbitMQ integration
- **Use Case**: Message queue integration and event-driven architecture
- **Features**: Message publishing/consuming, queue management

##### [`@platformatic/kafka-hooks`](https://github.com/platformatic/kafka-hooks)

- **Description**: Kafka integration
- **Use Case**: Streaming data processing and event sourcing
- **Features**: Stream processing, topic management, event sourcing

### Adding Custom Capabilities

Install the custom capability in its owning workspace package, check Watt 4
compatibility, and set its package name as `module` in the application configuration.
Read its schema and documentation for the actual options; a generator implementation
is not required.

## Skill-first workflow

Install the [Watt agent skill](./use-watt-with-ai-agents.md), then ask your agent to
create or integrate the application using the appropriate capability. The agent
inspects framework signals, preserves your package manager, and writes source,
configuration, workspace manifests, env examples, and tests directly.

Examples:

- "Create a Watt HTTP service using `@platformatic/service`."
- "Integrate this existing Next.js application using `@platformatic/next`."
- "Add `@my-company/custom-plugin` using its schema and package documentation."
- "Create a workspace with a database API and a Next.js frontend."

See [scaffolding](../skills/watt/references/scaffolding.md),
[frameworks](../skills/watt/references/frameworks.md), and
[application integration](../skills/watt/references/integration.md) for complete steps.
Use npm, Yarn, or pnpm consistently with the existing lockfile. Git initialization,
commits, and pushes are separate user-authorized operations, not part of scaffolding.
