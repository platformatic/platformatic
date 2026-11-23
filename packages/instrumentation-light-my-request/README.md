# @platformatic/instrumentation-light-my-request

OpenTelemetry instrumentation for [light-my-request](https://github.com/fastify/light-my-request).

Requests injected with `light-my-request` never reach the Node.js HTTP server, so `@opentelemetry/instrumentation-http` does not trace them. This instrumentation creates a `SERVER` span for each of them, which covers:

- `fastify.inject()` calls;
- the requests that [undici-thread-interceptor](https://github.com/platformatic/undici-thread-interceptor) delivers to a Watt application.

It only uses the global OpenTelemetry API, so it works with any `TracerProvider`, including the ones registered by third-party observability products.

## Install

```sh
npm install @platformatic/instrumentation-light-my-request
```

## Usage

Register the instrumentation before `light-my-request` (or `fastify`) is loaded:

```js
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { LightMyRequestInstrumentation } from '@platformatic/instrumentation-light-my-request'

registerInstrumentations({
  instrumentations: [new LightMyRequestInstrumentation()]
})
```

Watt registers it automatically when [tracing](https://docs.platformatic.dev/docs/reference/runtime/configuration#tracing) is enabled.

## Spans

Each span is named `METHOD path` and is renamed to `METHOD route` when a framework instrumentation (for instance `@fastify/otel`) reports the matched route through the OpenTelemetry RPC metadata.

The trace context is extracted from the request headers using the global propagator.

| Attribute                   | Description                                         |
| --------------------------- | --------------------------------------------------- |
| `http.request.method`       | The request method.                                 |
| `http.response.status_code` | The response status code.                           |
| `http.route`                | The matched route, when reported by the framework.  |
| `server.address`            | The host name from the `host` header.               |
| `server.port`               | The port from the `host` header, when present.      |
| `url.full`                  | The full request URL.                               |
| `url.path`                  | The request path.                                   |
| `url.query`                 | The request query string, when present.             |
| `url.scheme`                | Always `http`.                                      |

The span status is set to `ERROR` when the response status code is `500` or greater.

## License

Apache 2.0
