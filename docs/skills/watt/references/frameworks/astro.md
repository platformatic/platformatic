# Astro on Watt 3

Detect `astro.config.*` and use `@platformatic/astro` rather than generic Vite.
Install compatible major 3 Watt packages with authorization and preserve Astro's
adapter, output mode, integrations, and existing build scripts.

```json
{
  "module": "@platformatic/astro",
  "runtime": { "server": { "hostname": "0.0.0.0", "port": "{PORT}" } }
}
```

Inspect the installed Astro capability's supported adapter and SSR contract before
changing a static site into a server-rendered app. Prefer default lifecycle commands
unless the project uses a custom build. Deploy server output and client assets together.

For a gateway-mounted app, align Astro's base configuration, `application.basePath`,
and the gateway prefix. Verify asset URLs, redirects, API endpoints, and SSR calls.
Allow mesh hostnames in the development server only as required by the framework.

Astro's compiler handles its source files and TypeScript; native stripping does not
replace the framework build. Verify development and production independently.
See [Vite](vite.md), [integration](../integration.md), and [Docker](../deployment/docker.md).
