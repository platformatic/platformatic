import Issues from '../../getting-started/issues.md';

# Configuration

Platformatic React Router is configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

It supports all the [settings supported by Platformatic Vite](../vite/configuration.md), plus the following one:

- **`reactRouter.outputDirectory`**: The subdirectory where production build is stored at when using `wattpm build` or `plt build`. The default is `build`.

:::note
Platformatic React Router uses this property instead of `application.outputDirectory` (which is ignored).
:::

<Issues />
