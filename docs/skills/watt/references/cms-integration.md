# CMS integration

Use a dedicated content-worker service when CMS webhooks, retries, and cache
invalidation deserve their own lifecycle. Keep the frontend and business API separate
when that matches the existing topology. See [enterprise](enterprise.md) for wiring.

## Content worker

```json
{
  "module": "@platformatic/service",
  "plugins": { "paths": ["./app.js"] },
  "service": { "openapi": true }
}
```

Use major 3 service dependencies. Configure the gateway with `gateway.applications`;
route only the intended webhook endpoints, and keep administrative endpoints private.

## Webhook processing

1. Verify the CMS signature or shared secret using the provider's documented contract.
   Missing server-side secrets must fail closed, not match a missing request header.
2. Validate the payload and map known content types to an allowlist of cache tags.
3. Deduplicate delivery IDs and make handlers idempotent; CMS retries are expected.
4. Call the frontend via its mesh address, such as
   `http://storefront.plt.local/api/revalidate`, with authentication and a timeout.
5. Check the response status before recording successful invalidation. Use the project's
   stable error codes and retry policy for failed requests.

Contentful payloads, Sanity payloads, and Strapi payloads have different shapes. Keep
their adapters separate instead of assuming all events contain `sys.contentType.sys.id`.
Preserve ordering requirements or use a durable queue for long-running work.

## Next.js invalidation

Read the installed Next.js version before selecting `revalidateTag`, `revalidatePath`,
or Cache Components APIs. Their signatures and semantics vary by framework version.
Protect the revalidation route itself; an internal hostname is not authentication.

Coordinate shared cache storage across workers and replicas. Verify a content change
through more than one worker and replica before claiming global invalidation.
See [Next.js](frameworks/nextjs.md) and [performance](performance.md).

## Preview and local development

Use explicit development fixtures rather than silently serving mock content in
production when credentials are missing. Keep preview credentials server-side.
Preview routes must validate tokens and allow only intended local redirect paths.
Use the installed framework's synchronous/asynchronous draft-mode API correctly.

Document required environment variable names in `.env.example`. Exercise malformed
payloads, authentication failure, duplicate delivery, downstream failure, preview,
and successful invalidation. Track latency and failures without logging secrets.
