# @platformatic/instrumentation-thread-interceptor

OpenTelemetry instrumentation for [undici-thread-interceptor](https://github.com/platformatic/undici-thread-interceptor).

It creates a `CLIENT` span for each request sent to another thread and injects the trace context in the request headers using the global propagator.

The receiving thread serves the request through `light-my-request`, so its `SERVER` span is created by [`@platformatic/instrumentation-light-my-request`](../instrumentation-light-my-request).

It only uses the global OpenTelemetry API, so it works with any `TracerProvider`, including the ones registered by third-party observability products.

## Install

```sh
npm install @platformatic/instrumentation-thread-interceptor
```

## Usage

`undici-thread-interceptor` is an ES module, so the [OpenTelemetry loader hook](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md) is required to patch it. Register the instrumentation before the module is loaded:

```js
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { ThreadInterceptorInstrumentation } from '@platformatic/instrumentation-thread-interceptor'

registerInstrumentations({
  instrumentations: [new ThreadInterceptorInstrumentation()]
})
```

When the module cannot be patched, for instance because the loader hook is not registered or the module was loaded before the instrumentation, pass the hooks explicitly:

```js
import { createInterceptor } from 'undici-thread-interceptor'
import { ThreadInterceptorInstrumentation } from '@platformatic/instrumentation-thread-interceptor'

const instrumentation = new ThreadInterceptorInstrumentation()
const interceptor = createInterceptor({ meshId: 'app', domain: '.local', ...instrumentation.createHooks() })
```

Hooks passed explicitly are detected, so the spans are not duplicated when the module is patched as well.

If you do not want the module to be patched at all, use the standalone hooks, which do not require an instrumentation instance:

```js
import { createInterceptor } from 'undici-thread-interceptor'
import { createThreadInterceptorHooks } from '@platformatic/instrumentation-thread-interceptor'

const interceptor = createInterceptor({ meshId: 'app', domain: '.local', ...createThreadInterceptorHooks() })
```

Watt adds the hooks automatically when [tracing](https://docs.platformatic.dev/docs/reference/runtime/configuration#tracing) is enabled.

## Avoiding duplicated spans

`undici-thread-interceptor` publishes the `undici` diagnostics channel events, so `@opentelemetry/instrumentation-undici` traces the same requests. When both instrumentations are registered, exclude the interceptor domain from the latter:

```js
new UndiciInstrumentation({
  ignoreRequestHook: request => request.origin.endsWith('.plt.local')
})
```

## Spans

Each span is named `METHOD url`, where `url` does not include the query string.

| Attribute                   | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `http.cache.hit`            | Whether the Watt HTTP cache served the response.               |
| `http.cache.id`             | The Watt HTTP cache entry identifier, when present.            |
| `http.request.method`       | The request method.                                            |
| `http.response.status_code` | The response status code.                                      |
| `server.address`            | The target host name.                                          |
| `server.port`               | The target port, when present.                                 |
| `url.full`                  | The full request URL.                                          |
| `url.path`                  | The request path.                                              |
| `url.scheme`                | The request scheme.                                            |

The span status is set to `ERROR` when the response status code is `400` or greater, or when no response is received.

## License

Apache 2.0
