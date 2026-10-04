# Watt mesh transport

This directory is a maintained Watt copy of `undici-thread-interceptor` 1.5.0
(https://github.com/platformatic/undici-thread-interceptor), with the original
MIT license retained in LICENSE. Watt ships this source with @platformatic/runtime,
so consumers need neither a package-manager patch nor unpublished dependency APIs.

The extension adds optional shared, generation-scoped request reservations,
bounded admission, backend completion tracking and cancellation cleanup. The
unconfigured request handler keeps the upstream round-robin path. Benchmark-only
pressure selection is internal and is not accepted by the public schema.

Compatibility with the upstream mesh messages is retained. Keep provenance and
compare this directory with upstream when updating the transport. Runtime integration
and reservation tests live under packages/runtime/test.
