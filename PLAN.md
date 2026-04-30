# Plan: OpenTelemetry support for pure ITC applications

## Summary

When an application exposes its functionality only through `globalThis.platformatic.messaging` (for example a Node app with `hasServer: false`), requests crossing the internal messaging boundary are currently invisible to telemetry.

The worker may already have OpenTelemetry bootstrapped, but `MessagingITC` does not:

- create a client span when `messaging.send()` is used
- propagate trace context to the target worker
- create a server/consumer span around the target handler
- mark messaging failures and timeouts on spans

This plan adds telemetry to the runtime messaging layer, only when telemetry is enabled.

---

## Goals

1. Preserve traces across `platformatic.messaging.send()` calls.
2. Create spans inside pure ITC applications, so they are no longer black holes in traces.
3. Keep overhead near zero when telemetry is disabled.
4. Avoid changing application-level handler signatures or payload shapes.
5. Reuse existing Platformatic telemetry bootstrap instead of inventing a parallel system.

## Non-goals

- Instrument the runtime control plane (`runtime <-> worker` ITC used for lifecycle/management).
- Change the public user payload sent over messaging.
- Rework all Fastify/service telemetry internals in the first step.

---

## Current state

Relevant code paths:

- `packages/runtime/lib/worker/itc.js`
  - creates `MessagingITC`
  - exposes it as `globalThis.platformatic.messaging`
- `packages/runtime/lib/worker/messaging.js`
  - request/response and notification transport between workers
- `packages/itc/lib/index.js`
  - generic ITC request/response implementation
- `packages/telemetry/lib/node-telemetry.js`
  - bootstraps OpenTelemetry for worker processes when runtime telemetry is enabled

Today, `MessagingITC.send()` forwards only the handler name and payload. The receiving side invokes the handler with no extracted trace context and no span wrapper. As a result:

- the caller trace stops at the worker making the ITC call
- the target pure ITC app produces no span for the work it performs
- timeouts/errors are reported to the caller but not reflected in telemetry

---

## Proposed design

### 1. Add a metadata carrier to ITC requests

Add an optional metadata field to the internal ITC envelope so higher layers can attach propagation data without mutating the user payload.

Implementation shape:

- extend `@platformatic/itc` request/notification send paths to accept optional request metadata from `options`
- attach it to the wire envelope, e.g. `request.meta`
- do **not** bump the request version; existing parsers already ignore unknown fields

This keeps telemetry transport generic and lets `MessagingITC` remain the only telemetry-aware caller.

### 2. Instrument `MessagingITC.send()`

When telemetry is active:

- determine the parent context
  - default: current active OpenTelemetry context
  - optional future-proof override: `options.telemetryContext`
- start a client span for the messaging operation
- inject trace headers into a small carrier object
- attach carrier + source application id to the ITC request metadata
- await the response
- end the span as success/error

If telemetry is not active, keep the current behavior unchanged.

### 3. Wrap registered handlers on the receiving side

`MessagingITC.handle()` already overrides the base `ITC.handle()`. We can use that to wrap user handlers.

The wrapper will:

- read trace metadata from the request context
- extract the incoming context
- start a server span for request/response messaging
- execute the user handler inside the extracted context
- end the span on success or error
- rethrow the original error so messaging semantics stay unchanged

This avoids invasive changes to `@platformatic/itc` request execution internals.

### 4. Instrument notifications too

For `messaging.notify()`:

- sender creates a short-lived `PRODUCER` span and injects trace metadata into the broadcast payload
- receiver creates a `CONSUMER` span around the notification handler

This is not the main bug, but it is cheap once the metadata path exists and makes messaging telemetry consistent.

---

## Telemetry model

### Span kinds

- `messaging.send()` caller: `CLIENT`
- request handler reached via `send()`: `SERVER`
- `messaging.notify()` sender: `PRODUCER`
- notification handler: `CONSUMER`

### Span naming

Use a stable format that is easy to spot in traces, for example:

- `ITC send <targetApplication>.<messageName>`
- `ITC handle <sourceApplication>.<messageName>`
- `ITC notify <targetApplication>.<messageName>`

Exact naming can be finalized during implementation, but it should be explicit that this is Platformatic internal messaging rather than HTTP.

### Attributes

Use a small, stable attribute set. Suggested attributes:

- `messaging.system = "platformatic-itc"`
- `messaging.operation = "send" | "notify"`
- `messaging.destination.name = <target application id>`
- `messaging.message.name = <handler name>`
- `platformatic.messaging.source = <source application id>`
- `platformatic.messaging.target = <target application id>`

For failures, reuse the existing error formatting used elsewhere in telemetry (`error.name`, `error.message`, `error.stack`) and mark span status as `ERROR`.

---

## Context propagation details

### Sender side

The sender should inject the client span context into a plain object carrier using the existing global propagator set by `node-telemetry.js`.

Example metadata payload:

```js
{
  sourceApplication: 'entrypoint',
  telemetry: {
    traceparent: '00-...'
  },
  mode: 'send'
}
```

This metadata lives in the ITC envelope, not inside `message`.

### Receiver side

The receiving wrapper should:

1. extract the carrier into an OpenTelemetry context
2. start the server/consumer span with that context as parent
3. run the user handler inside that context
4. end the span after the handler settles

That ensures any nested spans created by the pure ITC application become children of the messaging span.

---

## Telemetry activation rules

Instrumentation should be enabled only when the worker has telemetry bootstrapped.

Practical rule:

- if `globalThis.platformatic.tracerProvider` or `globalThis.platformatic.telemetryReady` is absent, skip instrumentation
- if `telemetryReady` exists but has not resolved yet, await it before first traced messaging operation

This matters for pure ITC apps because telemetry is loaded through `--import @platformatic/telemetry/lib/node-telemetry.js` and may initialize asynchronously.

---

## Files likely involved

### Core runtime changes

- `packages/runtime/lib/worker/messaging.js`
  - client span creation
  - metadata injection
  - handler wrapping
  - notification instrumentation

### Generic ITC support

- `packages/itc/lib/index.js`
  - allow `send()` / `notify()` to carry optional request metadata in the envelope

### Telemetry helpers

Preferred:

- new helper in `packages/telemetry/lib/` (for example `messaging-telemetry.js`)

This helper should centralize:

- tracer lookup
- context extraction/injection
- span start/end helpers
- attribute naming

That keeps raw OpenTelemetry API usage out of runtime code and makes testing easier.

---

## Compatibility

- No public payload changes.
- Existing handlers continue to receive the same first argument.
- Existing handlers can ignore the second `context` argument as they do today.
- No behavior change when telemetry is disabled.
- Reused worker channels remain fine because source app + trace carrier travel with each request, not with the channel itself.

---

## Testing plan

### 1. Runtime integration test for pure ITC apps

Add a fixture similar to `packages/node/test/fixtures/messaging`, but with telemetry enabled and a file/memory exporter.

Scenario:

- HTTP entrypoint receives a request
- entrypoint calls `platformatic.messaging.send()` to a `hasServer: false` app
- assert exported spans contain:
  - the HTTP/server span in the entrypoint
  - a messaging client span in the caller
  - a messaging server span in the pure ITC app
- assert the pure ITC app span has the same trace id and is parented correctly

### 2. Error path

- target handler throws
- assert caller still gets the same error behavior
- assert both client and server messaging spans are marked `ERROR`

### 3. Timeout path

- target handler never responds or channel closes
- assert `MessagingError` behavior is unchanged
- assert client span is marked `ERROR`

### 4. Disabled telemetry

- same fixture with telemetry disabled
- assert behavior is unchanged and no telemetry-specific metadata path is required

### 5. Notification path

If included in the first implementation:

- assert `notify()` creates producer/consumer spans with shared trace id

---

## Risks / edge cases

1. **Telemetry readiness race**
   - messaging can be used very early during startup
   - mitigate by awaiting `globalThis.platformatic.telemetryReady` when present

2. **Span parenting in non-node-telemetry apps**
   - Fastify/service apps using manual telemetry hooks may not expose an active global OTel context today
   - initial implementation should target the pure ITC/node-telemetry case
   - if needed later, we can expose a shared global telemetry bridge for manual-plugin capabilities too

3. **Envelope bloat**
   - trace metadata is tiny (`traceparent` and possibly `tracestate`)
   - acceptable compared with the benefit

4. **Handler wrapping transparency**
   - wrapper must preserve current error semantics exactly
   - all errors must still surface as the same `HandlerFailed` / `MessagingError` chain on the caller side

---

## Recommended implementation order

1. Add optional request metadata support in `@platformatic/itc`.
2. Add a small telemetry helper module under `@platformatic/telemetry`.
3. Instrument `MessagingITC.send()` for request/response messaging.
4. Wrap `MessagingITC.handle()` on the receiver side.
5. Add error/timeout coverage.
6. Extend the same mechanism to `notify()`.
7. Add integration tests for pure ITC apps with telemetry enabled.

---

## Expected outcome

After this change, a pure ITC application will appear in distributed traces just like an HTTP-backed service:

- the caller will emit a messaging client span
- the pure ITC worker will emit a child server/consumer span
- nested work inside that worker will attach to the correct trace
- failures and timeouts will be visible in telemetry

This closes the current observability gap without changing the user-facing messaging API.
