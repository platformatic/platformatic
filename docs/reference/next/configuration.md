import Issues from '../../getting-started/issues.md';
import RuntimeInCapabilities from '../\_runtime-in-capabilities.md';

# Configuration

Platformatic Next is configured through a configuration file. It supports environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## `application`

Supported object properties:

- **`basePath`**: Service proxy base path when exposing this application in a [gateway](../gateway/configuration.md) with the `proxy` property. If not specified, the application is exposed on `/$ID` (where `$ID` is the application ID), or on a value specified in application code via `platformatic.setBasePath()`.
- **`outputDirectory`**: Subdirectory where the production build is stored when using `wattpm build` or `plt build`. Default: `dist`.
- **`include`**: Paths to include when deploying the application. Default: `['dist']`.
- **`commands`**: Object specifying commands to manage the application instead of Next.js defaults:
  - **`install`**: Command to install application dependencies. Default: `npm ci --omit-dev`.
  - **`build`**: Command to build the application.
  - **`development`**: Command to start the application in development mode.
  - **`production`**: Command to start the application in production mode.
- **`changeDirectoryBeforeExecution`**: If `true`, change the current working directory to the application root before running any of the commands above. Default: `false`.
- **`preferLocalCommands`**: If `true`, resolve non-absolute commands from the application's `node_modules/.bin` before checking the current working directory. Default: `true`.

## `logger`

Configures the `logger`. See [runtime logger](../runtime/configuration.md#logger).

## `server`

Configures the HTTP server. See [runtime server](../runtime/configuration.md#server).

## `watch`

Manages watching of the application. See [application watch](../service/configuration.md#watch).

## `cache`

Configures an [Incremental Server Rendering cache](https://nextjs.org/docs/app/api-reference/next-config-js/incrementalCacheHandlerPath) handler or [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components) cache handlers.

Supported object properties:

- **`enabled`** (`boolean` or `string`): If `false`, the cache adapter is disabled. Default: `true`.
- **`adapter`**: Adapter to use. Supported values are `valkey` and `redis` (`redis` is an alias of `valkey`).
- **`url`**: URL of the Valkey/Redis server.
- **`prefix`**: Prefix for all cache keys.
- **`maxTTL`**: Maximum key lifetime (seconds). If Next.js `revalidate` is greater than this value, key expiry is refreshed while accessed at least every `maxTTL` seconds. Default: `604800` (one week).
- **`cacheComponents`**: Use [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components) instead of ISR cache handlers. Alternative to `cacheComponents: true` in `next.config.js`. Supported from Next.js 16.0.
- **`ignoreNextConfig`**: Ignore cache-related values already defined in `next.config.js` and prefer Platformatic configuration.
- **`remote`**: Optional configuration for the [`"use cache: remote"`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote) directive. When present, a separate `cacheHandlers.remote` is registered alongside `cacheHandlers.default`. All properties are optional and inherit from the parent `cache` config when omitted. Requires `cacheComponents: true`. Supported object properties:
  - **`url`**: URL of the Valkey/Redis server for remote cache entries.
  - **`prefix`**: Prefix for remote cache keys.
  - **`maxTTL`**: Maximum key lifetime (seconds) for remote cache entries.

  Example using separate Valkey instances for default and remote cache:

  ```json
  {
    "cache": {
      "adapter": "valkey",
      "url": "valkey://localhost:6379",
      "cacheComponents": true,
      "remote": {
        "url": "valkey://remote-server:6379",
        "prefix": "plt:remote",
        "maxTTL": 3600
      }
    }
  }
  ```

  In this configuration, `"use cache"` entries are stored on `localhost:6379` while `"use cache: remote"` entries go to `remote-server:6379` with a separate prefix and a 1-hour TTL. If `remote.url` is omitted, both handlers share the same Valkey instance but use different key namespaces to avoid collisions.

## `next`

Configures Next.js. Supported object properties:

- **`trailingSlash`**: Enables [trailingSlash](https://nextjs.org/docs/pages/api-reference/config/next-config-js/trailingSlash) in `next.config.js`.
- **`useExperimentalAdapter`**: Enables [`experimental.adapterPath`](https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath) integration to modify `next.config.js` automatically. For Next.js versions earlier than 16, this setting is ignored.

  Add this to your `next.config.js`:

  ```js
  import { getAdapterPath } from '@platformatic/next'

  module.exports = {
    experimental: {
      adapterPath: getAdapterPath()
    }
  }
  ```

- **`standalone`**: Set to `true` when using [Next.js standalone mode](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output).
- **`https`**: Enables HTTPS in development mode when Platformatic starts Next.js with the default development command.
  - **`enabled`** (`boolean` or `string`): Enables Next.js experimental HTTPS.
  - **`key`**: Path (relative to the application root) to the HTTPS private key file.
  - **`cert`**: Path (relative to the application root) to the HTTPS certificate file.
  - **`ca`**: Path (relative to the application root) to the HTTPS certificate authority file.
- **`imageOptimizer`**: Configures Next.js Image Optimizer mode. When enabled, this service runs only the `/_next/image` API endpoint (instead of the full Next.js app). Supported object properties:
  - **`enabled`**: Boolean flag to enable the mode. Default: `false`.
  - **`fallback`**: URL or service name used to fetch original images:
    - Full URL (for example, `https://example.com`)
    - Local service name (for example, `backend`), resolved to `http://backend.plt.local`
  - **`storage`**: Queue storage backend:
    - `{ "type": "memory" }` (default)
    - `{ "type": "filesystem", "path": ".next/cache/image-optimizer" }`
    - `{ "type": "valkey", "url": "redis://localhost:6379/0", "prefix": "my-app:" }` (or `redis`)
  - **`timeout`** (`number` or `string`): Timeout in milliseconds used for image fetch/optimization operations. Default: `30000`.
  - **`maxAttempts`** (`number` or `string`): Maximum retry attempts for optimization jobs. Default: `3`.

<RuntimeInCapabilities />

<Issues />
