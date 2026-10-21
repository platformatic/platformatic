# PHP, WordPress, and Laravel

`@platformatic/php` is an external capability. Inspect its installed version, supported
Watt major, PHP runtime, extensions, and configuration schema before generating files.
Do not assume its package version follows the core Watt release numbering.

## Detection

- WordPress: `wp-config.php`, plugins/themes, and uploads.
- Laravel: `artisan`, `composer.json`, and a `public` document root.
- Generic PHP: Composer metadata and the actual public entrypoint.

Keep `wattpm` on major 3 and choose a demonstrably compatible PHP capability version.
Use the capability's schema to configure document root, router, PHP settings, and
environment. Do not substitute Node capability options or guess PHP option names.

## Integration review

Preserve Composer dependency installation, PHP extensions, database configuration,
rewrite rules, static assets, session storage, and background queue processes.
Keep persistent uploads and application data outside ephemeral container layers.
Review proxy host/protocol handling and canonical URL configuration behind the gateway.

For WordPress, verify admin routes, permalinks, media uploads, cron, and plugins.
For Laravel, verify routes, storage links, cache/config commands, queues, and migrations.
Run Composer scripts, migrations, or cache rebuilds only when authorized.

Test deployment on the target OS/architecture with the capability's required native
dependencies. See [Docker](../deployment/docker.md) and [integration](../integration.md).
