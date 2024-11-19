import SharedConfiguration from './_shared-configuration.md'

# Configuration

Platformatic Runtime is configured with a configuration file. It supports the
use of environment variables as setting values with [environment variable placeholders](#environment-variable-placeholders).

## Configuration Files

The Platformatic CLI automatically detects and loads configuration files found in the current working directory with the file names listed [here](../file-formats.md#configuration-files).

Alternatively, you can use the `--config` option to specify a configuration file path for most `platformatic runtime` CLI commands. The configuration examples in this reference use the JSON format.

<SharedConfiguration/>
