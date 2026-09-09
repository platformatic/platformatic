import Issues from '../../getting-started/issues.md';
import RuntimeInCapabilities from '../_runtime-in-capabilities.md';

# Configuration

Platformatic Remix is configured with a configuration file. The file is a module that exports its configuration, so it reads
[environment variables](../service/configuration.md#environment-variables) directly.

It supports all the [settings supported by Platformatic Vite](../vite/configuration.md), plus the following one:

- **`remix.outputDirectory`**: The subdirectory where production build is stored at when using `wattpm build` or `plt build`. The default is `build`.

:::note
Platformatic Remix uses this property instead of `application.outputDirectory` (which is ignored).
:::

<RuntimeInCapabilities />

<Issues />
