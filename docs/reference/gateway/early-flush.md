# Early Flush

Early flush learns a reusable HTML prefix from completed upstream responses. Once learned, the gateway sends that
prefix immediately while it obtains the current response, verifies and removes its duplicate prefix, and streams the
fresh suffix. Every request still obtains a response; this is not a full-page cache.

## Configuration

Configure early flush separately for each application under `gateway.applications[].proxy.earlyFlush`:

```json
{
  "gateway": {
    "compression": true,
    "applications": [
      {
        "id": "frontend",
        "proxy": {
          "prefix": "/",
          "earlyFlush": {
            "enabled": true,
            "routes": [{ "method": "GET", "path": "/products/:id" }],
            "windowSize": 30,
            "minPreludeBytes": 512
          }
        }
      }
    ]
  }
}
```

There is no global early-flush configuration. An absent or empty `routes` list admits no requests.

| Option | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Enable with `true` or `"true"`. |
| `routes` | `[]` | Explicit `find-my-way` patterns, each with `path` and `method` or `methods`. |
| `key` | Unset | Module exporting `computePreludeKey` or a default function. |
| `windowSize` | `30` | Number of completed samples required for promotion. |
| `minPreludeBytes` | `512` | Minimum HTML-safe common prefix size. |
| `maxPrefixBytes` | `65536` | Maximum bytes captured from each HTML response. |
| `maxKeys` | `1000` | Maximum number of retained keys per application and worker. |
| `prefixPolicy` | `conservative` | Retain historical prefix constraints, or use `fifo` for the current window. |
| `redirectPolicy` | `conservative` | Suspend promotion after a redirect, or use `fifo` until it leaves the window. |

Limits must be positive integers and `minPreludeBytes` must not exceed `maxPrefixBytes`.
Storage is an in-memory LRU local to each gateway worker. Restarting the worker clears it. There is no TTL or shared
backend. The limits bound retained keys and prefix samples, not total process memory, active streams or deduplication storage.

## Routes and keys

Matching uses the incoming public path, including any gateway proxy prefix, without its query string. Supported methods
are `GET`, `HEAD`, `OPTIONS` and `QUERY`. The proxy must also expose the chosen method; add `QUERY` to `proxy.methods`
when needed. WebSocket upgrades, Range requests and requests with any `If-*` header bypass early flush.

The default key is the uppercase method, a space and the matched route pattern:

```text
GET /products/:id
```

Thus `/products/1`, `/products/2` and `/products/2?lang=it` share a prelude by default. Storage is separate for each
application, but hosts, query strings, users and languages are not automatically separated within that application.
Use a custom key when those distinctions affect the reusable prefix or replayed metadata.

```js title="prelude-key.js"
export async function computePreludeKey (request, { route, params, application }) {
  if (request.headers.authorization) {
    return null
  }

  return `${request.method} ${route} ${request.headers['accept-language'] ?? 'en'}`
}
```

Set `key` to the module path, resolved relative to the gateway root. The function receives the native Fastify request
and `{ route, params, application }`; it may be asynchronous. The public `ComputePreludeKey` TypeScript type describes
this contract. A falsy result bypasses both learning and serving. Exceptions or invalid nonempty results are logged and
also bypass early flush. Request bodies are not consumed to construct a key.

## Learning and response eligibility

Only completed full HTML 2xx responses train a reusable prefix. Incomplete or failed streams do not contribute samples.
Promotion requires a full HTML-only window, stable status and exact Content-Type, and a sufficiently long shared prefix
ending at an HTML-safe boundary. Comparison preserves original bytes, including UTF-8 encoding. Learning freezes after
promotion; later successful hits verify the response without recomputing its prefix.

Responses with partial content, non-identity encoding, Set-Cookie, CSP nonces, `Vary: *`, or uncovered Vary fields are not
eligible. HEAD never receives an early body. Redirects other than 304 contribute redirect-policy evidence.

The optional `headers` object controls metadata:

| Option | Default | Meaning |
| --- | --- | --- |
| `allowlist` | See below | Header names retained for replay and verification. |
| `excludeSetCookie` | `true` | Exclude successful responses carrying cookies. |
| `excludeCspNonce` | `true` | Exclude successful responses with a CSP nonce. |
| `keyHeaders` | `[]` | Vary fields already represented by the custom key. |
| `cacheControl` | `no-store` | Cache-Control applied to anticipated responses. |

The default allowlist is `content-type`, `content-language`, `link`, `content-security-policy`, `referrer-policy` and
`x-content-type-options`. Keep `content-type` in a custom allowlist. Cookies, transport headers, validators, digests,
Accept-Ranges, X-Early-Flush and fields nominated by Connection are never replayed, even if allowlisted.
Other replayable headers come from the latest sample, including omissions; on a hit they must match the actual response.
Configured Cache-Control overrides the upstream value on hits.

`keyHeaders` declares coverage; it does not add values to the key. Accept-Encoding is handled by the gateway and does not
need inclusion. Request cookies do not automatically bypass early flush. Response cookie exclusions do not replace
correct key isolation: the prefix is sent before the current upstream response can be checked.

## Compression and deduplication

After route admission and successful nonempty key resolution, the gateway requests `Accept-Encoding: identity` from
both mesh and remote upstreams, during learning and serving. A custom-key bypass does not modify that header on behalf
of early flush; the gateway's ordinary compression rules still apply.

If an upstream ignores identity and returns compressed bytes, the response does not train. On an already-started hit,
it is incompatible: the prelude is invalidated and the stream terminates.

Output compression remains controlled by `gateway.compression` and the application's `proxy.compression` setting.
The final stream, containing prelude and fresh suffix, passes through the gateway compressor once. Its idle flush lets
the client decode the prelude before the upstream response arrives.

Early flush wraps deduplication. Both leaders and waiters can receive a prelude immediately. Deduplication stores the
complete upstream response before early-flush transformation; waiters verify and strip its prefix like leaders.
Disconnecting a leader does not stop shared upstream work needed by its waiters.
Deduplication separates admitted response producers from ordinary proxy requests, including when a custom deduplication
key is configured. This prevents a bypass response negotiated with compression from being replayed to an identity producer.

Custom proxy handlers using `reply.send()` or `reply.from()` bypass early flush and retain native Fastify semantics.
To opt in, the handler module can default-export an object with `handler` and `acquireResponse` functions:

```js
import { Readable } from 'node:stream'

export default {
  handler (request, reply, dest, options) {
    return reply.from(dest, options)
  },
  async acquireResponse (request, dest, options) {
    // Produce bytes without writing to the client reply.
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      stream: Readable.from(['<!doctype html><html><body>Hello</body></html>'])
    }
  }
}
```

`acquireResponse` runs only for admitted early-flush requests. It returns response metadata and a Node byte stream,
directly or through a promise; the gateway owns and consumes that stream. It must honor identity upstream encoding
and must not cancel shared upstream work when the leader client disconnects. Bypassed requests use `handler`.
The gateway applies deduplication to the producer's full response, then early flush and final compression.
Only the final response is sent through Fastify; no reply facade or custom payload serialization is involved.
TypeScript integrations can import `AcquireProxyResponse` and `ProxyResponse` from `@platformatic/gateway`.

## Failures and diagnostics

After early output, the gateway cannot replace the status or headers. A prefix mismatch, short body or incompatible
successful status/metadata invalidates that generation and terminates the response. Later requests learn again.
Generation checks prevent older requests from deleting or repopulating newer state.

Late redirects are drained, recorded according to `redirectPolicy`, and fail the hit without forwarding redirect bytes.
HTTP 4xx/5xx and transport failures terminate the hit without automatically invalidating the prelude. Client
disconnections stop the request's stream and discard partial learning samples.

`X-Early-Flush` reports `miss`, `hit`, or `bypass` for requests evaluated by the feature. A hit describes the initial
decision, not eventual success. Requests outside configured routes or excluded by protocol conditions retain ordinary
proxy behavior. Debug logs contain structured `earlyFlush` decisions, promotions, verification, invalidation and terminal
events, without cache keys or prefix content. `verified` refers to upstream verification; `completed` follows client
response completion, including compression. Resolver and stream errors are logged separately.

Application errors use these codes:

- `PLT_GATEWAY_EARLY_FLUSH_INVALID_OPTION`
- `PLT_GATEWAY_EARLY_FLUSH_MISMATCH`
- `PLT_GATEWAY_EARLY_FLUSH_UPSTREAM_ERROR`
- `PLT_GATEWAY_EARLY_FLUSH_CANCELLED`
