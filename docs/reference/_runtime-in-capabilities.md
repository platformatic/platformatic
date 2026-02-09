## `runtime`

The `runtime` property allows you to embed runtime configuration directly in your application's configuration file. This is useful when you want to configure runtime-level settings specific to this application without needing a separate runtime configuration file.

See the [runtime configuration](./runtime/configuration.md) documentation for details on each property.

### Available properties

The following runtime properties can be configured at the application level:

- [**`preload`**](./runtime/configuration.md#preload): Files to load before the application code.
- [**`workers`**](./runtime/configuration.md#workers): Worker configuration for this application.
- [**`logger`**](./runtime/configuration.md#logger): Logger configuration.
- [**`server`**](./runtime/configuration.md#server): Server configuration (hostname, port, HTTPS, HTTP/2).
- [**`watch`**](./runtime/configuration.md#watch): Enable/disable file watching.
- [**`health`**](./runtime/configuration.md#health): Health check configuration.
- [**`telemetry`**](./runtime/configuration.md#telemetry): OpenTelemetry configuration.
- [**`undici`**](./runtime/configuration.md#undici): Undici HTTP client configuration.
- [**`httpCache`**](./runtime/configuration.md#httpcache): HTTP caching configuration.
- [**`metrics`**](./runtime/configuration.md#metrics): Prometheus metrics configuration.
- [**`gracefulShutdown`**](./runtime/configuration.md#gracefulshutdown): Shutdown timeout settings.
- [**`startTimeout`**](./runtime/configuration.md#starttimeout): Application start timeout.
- [**`restartOnError`**](./runtime/configuration.md#restartonerror): Restart behavior on errors.
- [**`compileCache`**](./runtime/configuration.md#compilecache): Node.js compile cache settings.

### Application-specific overrides

Within the `runtime` property, you can also use the `application` sub-property to configure application-specific settings that would normally be set in the runtime's [`applications`](./runtime/configuration.md#applications) array:

- **`workers`**: Worker count for this application.
- **`health`**: Health check settings for this application.
- **`env`**: Environment variables.
- **`envfile`**: Path to an `.env` file.
- **`sourceMaps`**: Enable source maps.
- **`preload`**: Files to preload.
- **`nodeOptions`**: Node.js options.
- **`execArgv`**: Arguments passed to worker threads.
- **`permissions`**: File system permissions.
- **`telemetry`**: Application-specific telemetry instrumentations.
- **`compileCache`**: Compile cache settings.

### Example

The following example uses `@platformatic/next`, but the same configuration applies to other capabilities like `@platformatic/node`, `@platformatic/astro`, `@platformatic/vite`, and `@platformatic/remix`.

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.31.0.json",
  "runtime": {
    "logger": {
      "level": "debug"
    },
    "workers": {
      "dynamic": true,
      "minimum": 1,
      "maximum": 4
    },
    "application": {
      "env": {
        "CUSTOM_VAR": "value"
      },
      "execArgv": ["--max-old-space-size=4096"]
    }
  }
}
```
