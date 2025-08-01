import Issues from '../../getting-started/issues.md';

# Caching

When using Platformatic Astro, you can easily cache your pages and actions.

First of all, make sure you use a [composer](../composer/overview.md) as the entrypoint of the application.

Then, enable `httpCache` in the [application configuration](../runtime/configuration.md#httpcache) file.

Finally, make sure your pages return a proper `Cache-Control` header.
See the [Astro documentation](https://docs.astro.build/en/guides/on-demand-rendering/#astroresponseheaders) to learn more.

You are all set!

<Issues />
