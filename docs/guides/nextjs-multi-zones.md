# Run Next.js Multi-Zones with Watt

Next.js Multi-Zones split a site into independently built applications that serve different paths on the same domain. Watt can run each zone in a separate worker while Platformatic Gateway routes requests to the correct application.

In this guide, you will configure two Next.js applications:

- `frontend` serves the root of the site at `/`
- `blog` serves `/blog` and all paths below it

## Configure the runtime

Create a Watt runtime with Gateway as its entrypoint:

```json title="watt.json"
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.0.0.json",
  "entrypoint": "gateway",
  "applications": [
    {
      "id": "gateway",
      "path": "./web/gateway"
    },
    {
      "id": "frontend",
      "path": "./web/frontend"
    },
    {
      "id": "blog",
      "path": "./web/blog"
    }
  ]
}
```

Each application runs independently. Gateway is the only public entrypoint.

## Configure Gateway

List both Next.js applications in the Gateway configuration:

```json title="web/gateway/watt.json"
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/3.0.0.json",
  "gateway": {
    "applications": [
      {
        "id": "blog"
      },
      {
        "id": "frontend"
      }
    ]
  }
}
```

Gateway obtains each public prefix from the application. The more specific `/blog` zone is listed before the root zone.

## Configure the root zone

The root application does not need a base path:

```json title="web/frontend/watt.json"
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.0.0.json"
}
```

It serves its pages and Next.js assets from `/` and `/_next`.

## Configure the blog zone

Set the blog application's public path with `application.basePath`:

```json title="web/blog/watt.json"
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.0.0.json",
  "application": {
    "basePath": "/blog"
  }
}
```

Platformatic Next applies this value to the Next.js `basePath` and advertises the same prefix to Gateway. Pages are served below `/blog`, and generated assets use `/blog/_next`.

The default Platformatic Next integration applies the base path while loading `next.config.js` or `next.config.mjs`. If a zone does not already have one of these files, add an empty configuration:

```js title="web/blog/next.config.js"
module.exports = {}
```

For Next.js 16 applications using `next.config.ts`, use the [experimental adapter path integration](../reference/next/experimental-adapter-path.md) instead.

Do not configure a separate Next.js `assetPrefix` for this layout. The base path already isolates each zone's generated assets. Use `assetPrefix` only when assets are served from a CDN or when the additional asset path is explicitly routed through Gateway.

## Link between zones

Navigation within a zone can use the Next.js `Link` component. Navigation to another zone must use a standard anchor so that the browser performs a full document navigation:

```jsx
export default function BlogLink () {
  return <a href='/blog'>Open the blog</a>
}
```

Similarly, the blog zone should link back to the root zone with `<a href='/'>`. Next.js cannot perform a client-side transition between applications that have separate routers and build outputs.

Keep pages that users frequently navigate between in the same zone to avoid unnecessary full page loads.

## Serve public assets

Next.js does not automatically add `basePath` to URLs that you write in application code. Include the zone prefix when referencing files from the blog's `public` directory:

```jsx
export default function Logo () {
  return <img src='/blog/logo.png' alt='Blog logo' />
}
```

The root zone can continue to use paths such as `/logo.png`.

## Run the application

Install the application dependencies, then start Watt from the runtime directory:

```bash
npx wattpm dev
```

The zones are available through one server:

- `http://localhost:3042/` serves `frontend`
- `http://localhost:3042/blog` serves `blog`

Gateway forwards page requests, generated assets, public files, image optimization requests, and development traffic such as hot module replacement under the same zone prefix.

## Limitations

- Every URL path must belong to one zone.
- Gateway does not rewrite links, HTML, React Server Component payloads, or generated asset URLs. The Gateway prefix and the Next.js base path must match.
- Cross-zone navigation reloads the page.
- Shared UI and utilities should live in workspace packages or other npm packages rather than being imported from another zone's build output.

For more information about the underlying Next.js pattern, see the [Next.js Multi-Zones guide](https://nextjs.org/docs/pages/guides/multi-zones).
