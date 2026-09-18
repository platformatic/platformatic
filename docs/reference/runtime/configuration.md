import SharedConfiguration from './_shared-configuration.md'

# Configuration

Platformatic Runtime is configured with a configuration file. The file is a module that exports
its configuration, so it reads [environment variables](#environment-variables) directly.

## Configuration Files

The Platformatic CLI automatically detects and loads the configuration file in the current working directory. There are four names, listed [here](../../file-formats.md#configuration-files), and one file per directory.

Alternatively, you can use the `--config` option to specify a configuration file path for most `wattpm` CLI commands. The examples in this reference are written as `watt.config.ts`; the same configuration in JavaScript differs only in that it carries no type annotations.

## Functional configuration

`createWattConfig`, and every capability factory (`createNodeConfig`, `createViteConfig`, and so
on), also accept a function instead of a plain object. The function can be sync or async; it is
called once, and its resolved return value becomes the configuration:

```ts config
import { createWattConfig } from 'wattpm'

export default createWattConfig(({ command, mode, production, env }) => ({
  watch: command === 'dev',
  logger: { level: mode === 'staging' ? 'debug' : production ? 'warn' : 'info' },
  applications: [/* … */]
}))
```

The function receives a `ConfigContext` (exported as a type by every capability, and by
`@platformatic/basic`):

- **`command`** (`'dev' | 'build' | 'start' | 'exec'`) - The CLI verb that triggered evaluation.
  `'exec'` covers every non-boot evaluation, including capability commands such as
  `db:migrations:apply`.
- **`mode`** (`string`) - A free-form variant name. Defaults to `'development'` under `wattpm dev`
  and `'production'` under `wattpm build`/`wattpm start`; override it with `--mode <name>`. Mode
  selects which env files are loaded (see [environment variables](#environment-variables)); it is
  not injected as an environment variable.
- **`production`** (`boolean`) - `true` under `start`, `--production`, and `build` (build always
  produces production artifacts).
- **`env`** (`object`) - A snapshot of `process.env` taken after env-file merging, at the start of
  evaluation. It does not include values from an `env` block. The context, including `env`, is
  frozen.
- **`root`** (`string`) - The absolute directory of the configuration file.
- **`addWatchFile(path)`** (`function`) - Declares a file the configuration reads (rather than
  imports), so `wattpm dev` watches it too. It is a no-op outside a watching command.

A bare function export (`export default (ctx) => createNodeConfig({ ... })`) works the same way as
passing the function to the factory.

Per-application configuration files accept the same functional form and receive the same context.

<SharedConfiguration/>
