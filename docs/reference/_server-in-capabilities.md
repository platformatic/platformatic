Configures the HTTP server. Supported object properties:

- **`hostname`** (`string`) — Hostname where the application listens for connections.
- **`port`** (`integer` or `string`) — Port where the application listens for connections. A managed capability only opens a listener when this property is configured; set it to `0` to request an ephemeral port. When `portAssignment` is set to `perWorkerIncrement`, this is the port assigned to worker 0.
- **`portAssignment`** (`string`) — Sets how the port is assigned when the application runs multiple workers. Default: `shared`. Set it to `shared` or leave it unset to make all workers listen on the same `port`, which requires `SO_REUSEPORT` support (available on Linux with Node.js 22.12+ or 23.1+; not available on macOS and Windows). Set it to `perWorkerIncrement` to give each worker its own port, starting from `port` (worker 0) and incrementing by one for each additional worker: use it when `SO_REUSEPORT` is not available or when you want to address each worker individually, typically behind an external load balancer. When workers are replaced or restarted they keep their port; when the application scales down, the workers with the highest ports are stopped first.
- **`backlog`** (`integer`) — Maximum length of the pending connection queue when the capability's underlying server API supports it.
- **`http2`** (`boolean`) — Enables HTTP/2 support. Default: `false`.
- **`https`** (`object`) — HTTPS configuration. Requires `key` and `cert`.
  - **`allowHTTP1`** (`boolean`) — Also accept HTTP/1.1 connections when `http2` is enabled. Default: `false`.
  - **`key`** (`string`, `object`, or `array`) — Private key, a `{ path }` object, or an array of either.
  - **`cert`** (`string`, `object`, or `array`) — Certificate, a `{ path }` object, or an array of either.
  - **`requestCert`** (`boolean`) — Request a client certificate.
  - **`rejectUnauthorized`** (`boolean`) — Reject clients without a valid certificate.

Capabilities pass listener settings through their supported server APIs. When `server.port` is omitted, managed capabilities do not open a listener. Runtime does not patch listener options when a framework does not expose a setting in a particular mode.
