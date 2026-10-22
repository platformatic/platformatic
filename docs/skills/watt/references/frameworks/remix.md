# Remix on Watt 3

Use `@platformatic/remix` for an existing Remix application. For React Router framework
mode, use the [React Router capability](react-router.md). Do not migrate frameworks as
a side effect of adding Watt.

```json
{
  "module": "@platformatic/remix",
  "runtime": { "server": { "hostname": "0.0.0.0", "port": "{PORT}" } }
}
```

Keep matching major 3 Watt packages and inspect compatibility with the installed Remix
version. Preserve the classic/Vite compiler choice, server module format, loaders,
actions, session storage, and production output path. Use lifecycle defaults where
possible, adding custom commands only for a verified custom build contract.

Build before production startup and deploy client assets with server output. Align
gateway prefix, public asset URLs, and application base path. Test document requests,
loader/action requests, redirects, cookies, and error boundaries through the gateway.

Allow `.plt.local` development hosts when required for mesh access. Keep server-only
dependencies out of client bundles and verify shutdown of external connections.
See [integration](../integration.md) and [Docker](../deployment/docker.md).
