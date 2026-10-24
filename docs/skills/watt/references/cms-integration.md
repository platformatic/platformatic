# CMS integration with Watt 4

Use a separate content application when webhook traffic/cache invalidation should be
isolated from business APIs. Typical topology: public Gateway → Next.js/API/content-worker;
CMS webhooks enter the Gateway's protected content route. Isolation permits per-application
workers, but independent pod scaling requires a corresponding deployment design.

Retain Contentful/Sanity/Strapi SDKs, cache semantics, preview behavior, and mock data.
Do not expose cache invalidation merely because the caller normally uses internal mesh.

## Configuration and routing

The content worker can be a Platformatic Service. In an ESM TypeScript package:

```ts
import { createServiceConfig } from '@platformatic/service'

export default createServiceConfig({
  plugins: { paths: ['./src/app.ts'] }
})
```

Install compatible `@platformatic/service` and its needed dependencies only with permission.
The root declares `applications`; Gateway uses `gateway.applications`:

```js
import { createGatewayConfig } from '@platformatic/gateway'

export default createGatewayConfig({
  server: { hostname: '0.0.0.0', port: Number(process.env.PORT || 3042) },
  gateway: {
    applications: [
      { id: 'storefront', proxy: { prefix: '/' } },
      { id: 'api', proxy: { prefix: '/api/v1', rewritePrefix: '/' } },
      { id: 'content-worker', proxy: { prefix: '/content', rewritePrefix: '/' } }
    ]
  }
})
```

Verify overlapping prefixes and actual rewriting. The webhook route below becomes
`https://your-domain.com/content/webhook/cms` only when this routing is applied correctly.
Do not proxy all private/admin routes automatically.

## Contentful webhook fragment

Merge the handler into the existing plugin and retain its coded-error convention.
Example reply codes below are application examples, not new Platformatic package codes.
Use JSON schema validation/body limits in production and provider signatures where available.

```ts
import type { FastifyInstance } from 'fastify'

interface ContentfulTypeIdentity {
  id?: string
}

interface ContentfulContentType {
  sys?: ContentfulTypeIdentity
}

interface ContentfulMetadata {
  contentType?: ContentfulContentType
}

interface ContentfulPayload {
  sys?: ContentfulMetadata
}

interface ContentfulRoute {
  Body: ContentfulPayload
}

const tagMap: Record<string, string> = {
  product: 'products',
  article: 'articles',
  page: 'pages',
  category: 'categories'
}

export default async function (app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }))
  app.post<ContentfulRoute>('/webhook/cms', async (request, reply) => {
    const secret = process.env.CMS_WEBHOOK_SECRET

    // Fail closed if the expected secret is absent or the request does not match it.
    if (!secret || request.headers['x-webhook-secret'] !== secret) {
      return reply.code(401).send({ code: 'APP_CMS_UNAUTHORIZED', error: 'Unauthorized' })
    }

    const contentType = request.body?.sys?.contentType?.sys?.id
    if (typeof contentType !== 'string') {
      return reply.code(400).send({ code: 'APP_CMS_INVALID_PAYLOAD', error: 'Invalid payload' })
    }
    const tag = Object.hasOwn(tagMap, contentType) ? tagMap[contentType] : undefined
    if (!tag) {
      return { success: true, ignored: true }
    }

    const token = process.env.REVALIDATION_SECRET
    if (!token) {
      return reply.code(503).send({ code: 'APP_CMS_REVALIDATION_UNAVAILABLE', error: 'Unavailable' })
    }

    let response: Response
    try {
      response = await fetch('http://storefront.plt.local/api/revalidate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tags: [tag] }),
        signal: AbortSignal.timeout(5000)
      })
      await response.arrayBuffer()
    } catch {
      app.log.warn({ contentType, tag }, 'Cache revalidation transport failed')
      return reply.code(502).send({ code: 'APP_CMS_REVALIDATION_FAILED', error: 'Revalidation failed' })
    }

    if (!response.ok) {
      return reply.code(502).send({ code: 'APP_CMS_REVALIDATION_FAILED', error: 'Revalidation failed' })
    }

    app.log.info({ contentType, tag }, 'Cache revalidation requested')
    return { success: true }
  })
}
```

Preserve provider retry/idempotency behavior and the app's existing coded-error convention;
do not acknowledge success when revalidation fails.

## Protected Next.js revalidation

Match the installed Next.js API. This example uses stale-while-revalidate with
`revalidateTag(tag, 'max')`; immediate invalidation requires the documented API for the
selected version. Do not change the user's freshness guarantee silently.

```ts
import { revalidateTag } from 'next/cache'

interface RevalidationPayload {
  tags?: unknown
}

const allowedTags = new Set(['products', 'articles', 'pages', 'categories'])

export async function POST (request: Request): Promise<Response> {
  const secret = process.env.REVALIDATION_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ code: 'APP_CMS_UNAUTHORIZED' }, { status: 401 })
  }

  let payload: RevalidationPayload
  try {
    payload = await request.json()
  } catch {
    return Response.json({ code: 'APP_CMS_INVALID_PAYLOAD' }, { status: 400 })
  }
  const tags = payload?.tags
  if (!Array.isArray(tags) || tags.length > 20 ||
      !tags.every(tag => typeof tag === 'string' && allowedTags.has(tag))) {
    return Response.json({ code: 'APP_CMS_INVALID_TAGS' }, { status: 400 })
  }

  for (const tag of tags) {
    revalidateTag(tag, 'max')
  }
  return Response.json({ revalidated: true, tags })
}
```

Use a dedicated internal token and keep it out of URLs/client bundles/logs. Merely
checking `Origin` does not authenticate server-to-server calls. Test cache propagation
across workers/replicas with the chosen adapter; see [Next.js](frameworks/nextjs.md).

## Contentful fetching and mocks

Document `CONTENTFUL_SPACE_ID`, delivery/preview access tokens, `CMS_WEBHOOK_SECRET`,
and `REVALIDATION_SECRET` in `.env.example` with no real credentials. Preserve the
actual variable names and map Contentful's webhook header to the configured secret.
Contentful webhook triggers commonly include publish/unpublish and content-type filters.

Use `createClient` from `contentful`, and `unstable_cache` when supported by the project's
Next version. Cache keys/tags can distinguish products (`products`) and articles (`articles`).
Initialize real SDK clients only when credentials exist; use an explicit development-only
mock mode otherwise. Do not silently serve mock content in production when secrets are missing.
Mock entries should preserve Contentful `sys.id` and `fields` shapes.

## Draft preview

Keep a separate preview client/token and protect the draft endpoint. Current Next versions
require awaiting `draftMode()` before `.enable()`. Require a configured nonempty preview
secret and validate the requested slug against permitted local paths/content lookup to
prevent open redirects. Do not use an unchecked `redirect(slug)` from a URL parameter.
Preserve preview vs delivery cache separation so draft content cannot leak to public users.

## Sanity and Strapi

- Sanity webhooks typically identify documents through `_type` and `_id`; map only
  supported types to allowlisted tags and verify provider signatures/secrets.
- Strapi commonly provides `model` and `entry.id`; inspect the installed version's
  payload/auth contract rather than assuming Contentful structure.
- Preserve provider retries, duplicate handling, batching, and logging of outcomes without secrets.

## Completion

With permission, test valid/invalid/missing secrets, malformed payloads, ignored content
types, upstream failures, cache freshness, duplicate webhooks, preview auth, and redirects.
Report version-dependent APIs and unverified multi-worker cache behavior explicitly.

## Resources

- [Contentful webhooks](https://www.contentful.com/developers/docs/webhooks/)
- [Next.js revalidation](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [Sanity webhooks](https://www.sanity.io/docs/webhooks)
- [Strapi webhooks](https://docs.strapi.io/dev-docs/backend-customization/webhooks)
