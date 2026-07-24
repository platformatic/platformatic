Configures the HTTP server. Supported object properties:

- **`hostname`** (`string`) — Hostname where the application listens for connections.
- **`port`** (`integer` or `string`) — Port where the application listens for connections.
- **`portAssignment`** (`string`) — Controls how worker ports are assigned. The default, `shared`, makes all workers listen on `port`. Set `perWorkerIncrement` to assign an incrementing port to each worker through its per-worker environment. It requires a positive base port from `server.port` or the application's `portEnv`; a missing or zero base port is invalid. Use `perWorkerIncrement` only with an external load balancer.
- **`backlog`** (`integer`) — Maximum length of the pending connection queue.
- **`http2`** (`boolean`) — Enables HTTP/2 support. Default: `false`.
- **`https`** (`object`) — HTTPS configuration. Requires `key` and `cert`.
  - **`allowHTTP1`** (`boolean`) — Also accept HTTP/1.1 connections when `http2` is enabled. Default: `false`.
  - **`key`** (`string`, `object`, or `array`) — Private key, a `{ path }` object, or an array of either.
  - **`cert`** (`string`, `object`, or `array`) — Certificate, a `{ path }` object, or an array of either.
  - **`requestCert`** (`boolean`) — Request a client certificate.
  - **`rejectUnauthorized`** (`boolean`) — Reject clients without a valid certificate.
