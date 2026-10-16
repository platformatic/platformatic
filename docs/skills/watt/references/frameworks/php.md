# PHP, WordPress, and Laravel compatibility

`@platformatic/php` is an **external capability** backed by the native Rust-based
`@platformatic/php-node` integration. Its Watt 4 compatibility is not established by
the core Watt skill. Detect it and retain useful application guidance, but do not install
an incompatible version or invent a Watt 4 helper/schema by changing a version number.

## Compatibility gate

Before generating configuration, inspect the installed package's version, exports,
schema, Node engine/native ABI requirements, and its own release documentation.
Confirm Watt 4 module configuration, managed listeners, lifecycle, and worker support.
If unsupported, report a blocker and preserve the working project; do not silently
upgrade it or substitute another framework.

Do not use removed Watt scaffolding/import commands. Watt 4's Node requirement is
24.20.0+, but that alone does not establish external native package compatibility.

## Detection and existing application structure

- WordPress: `wp-config.php`, `wp-content`, `wp-admin`, `wp-includes`, `index.php`.
- Laravel: `artisan`, `composer.json`, `public/index.php`, `app/`, `routes/`, `resources/`.
- Generic PHP: Composer metadata and a PHP document root/front controller.

Preserve the actual `docroot`, filesystem permissions, extensions, uploads, and existing
database infrastructure. Follow the [php-node installation guide](https://github.com/platformatic/php-node)
for native libraries; a system PHP executable alone may not satisfy embedding requirements.

## WordPress environment

Keep database secrets outside source. Existing `wp-config.php` can read:

```php
define('DB_NAME', getenv('DB_NAME') ?: 'wordpress');
define('DB_USER', getenv('DB_USER') ?: 'wordpress');
define('DB_PASSWORD', getenv('DB_PASSWORD') ?: '');
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
```

Require real credentials for production; do not use example/root passwords. Preserve
WordPress salts, plugin directories, site URLs, and persistent `wp-content` uploads.

## Laravel routing

Preserve the front-controller rewrite contract of the installed capability. Older
packages used `rewriter.rules` to route requests through `/index.php`; verify that
option before emitting a new module configuration. Keep Laravel's Composer dependencies,
APP_KEY, storage/cache permissions, routes, and existing `.env` intact.

## Multi-application and headless architecture

If a compatible capability is available, keep WordPress/Laravel and a Next.js frontend
as separate application entries in the Watt root, with Gateway public routing. JS
server-side callers can use `http://wordpress.plt.local` for an internally reachable
application. Do not assume PHP outbound HTTP clients automatically use the Node mesh;
verify the package's integration first.

Container setups must match native PHP libraries to architecture/libc. A development
MySQL/MariaDB container can use persistent volumes and a health check, with credentials
injected from an untracked env file or secret store. Avoid baking secrets or uploads into
an immutable image. Verify DB reachability, plugin loading, rewrites, and graceful shutdown.

## Common issues

- Native loading: inspect supported OS/architecture, native library dependencies, and Node ABI.
- DB connection: check actual host/network and env names without logging passwords.
- Plugins missing: confirm `wp-content/plugins` under the real document root.
- Laravel 404: check front-controller rewriting and permissions against installed docs.

## Resources

- [PHP capability](https://github.com/platformatic/php)
- [PHP native runtime](https://github.com/platformatic/php-node)
- [WordPress + Next.js example](https://github.com/platformatic/watt-next-wordpress) — inspect its versions before reuse.
- [Laravel example](https://github.com/platformatic/watt-next-laravel) — inspect its versions before reuse.
