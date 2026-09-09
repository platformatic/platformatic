import SharedConfiguration from '../runtime/_shared-configuration.md'

# Configuration 

Watt is configured with a configuration file. The file is a module that exports
its configuration, so it reads [environment variables](#environment-variables) directly.

## Configuration Files

Watt automatically detects and loads the configuration file in the current working directory. There are four names, listed [here](../../file-formats.md#configuration-files), and one file per directory.

Alternatively, you can use the `--config` option to specify a configuration file path for most `wattpm` CLI commands. The examples in this reference are written as `watt.config.ts`; the same configuration in JavaScript differs only in that it carries no type annotations.

<SharedConfiguration/>