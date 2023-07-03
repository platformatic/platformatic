# Configuration

Platformatic Runtime is configured with a configuration file. It supports the
use of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## Configuration file

If the Platformatic CLI finds a file in the current working directory matching
one of these filenames, it will automatically load it:

- `platformatic.runtime.json`
- `platformatic.runtime.json5`
- `platformatic.runtime.yml` or `platformatic.runtime.yaml`
- `platformatic.runtime.tml` or `platformatic.runtime.toml`

Alternatively, a [`--config` option](/reference/cli.md#service) with a configuration
filepath can be passed to most `platformatic runtime` CLI commands.

The configuration examples in this reference use JSON.

### Supported formats

| Format | Extensions |
| :-- | :-- |
| JSON | `.json` |
| JSON5 | `.json5` |
| YAML | `.yml`, `.yaml` |
| TOML | `.tml` |

Comments are supported by the JSON5, YAML and TOML file formats.

## Settings

Configuration settings are organized into the following groups:

- [`autoload`](#autoload)
- [`services`](#services)
- [`entrypoint`](#entrypoint) **(required)**
- [`hotReload`](#hotReload)
- [`allowCycles`](#allowCycles)

Configuration settings containing sensitive data should be set using
[configuration placeholders](#configuration-placeholders).

The `autoload` and `services` settings can be used together, but at least one
of them must be provided. When the configuration file is parsed, `autoload`
configuration is translated into `services` configuration.

### `autoload`

The `autoload` configuration is intended to be used with monorepo applications.
`autoload` is an object with the following settings:

- **`path`** (**required**, `string`) - The path to a directory containing the
microservices to load. In a traditional monorepo application, this directory is
typically named `packages`.
- **`exclude`** (`array` of `string`s) - Child directories inside of `path` that
should not be processed.
- **`mappings`** (`object`) - Each microservice is given an ID and is expected
to have a Platformatic configuration file. By default the ID is the
microservice's directory name, and the configuration file is expected to be a
well-known Platformatic configuration file. `mappings` can be used to override
these default values.
  - **`id`** (**required**, `string`) - The overridden ID. This becomes the new
  microservice ID.
  - **`config` (**required**, `string`) - The overridden configuration file
  name. This is the file that will be used when starting the microservice.

### `services`

`services` is an array of objects that defines the microservices managed by the
runtime. Each service object supports the following settings:

- **`id`** (**required**, `string`) - A unique identifier for the microservice.
When working with the Platformatic Composer, this value corresponds to the `id`
property of each object in the `services` section of the config file. When
working with client objects, this corresponds to the optional `serviceId`
property or the `name` field in the client's `package.json` file if a
`serviceId` is not explicitly provided.
- **`path`** (**required**, `string`) - The path to the directory containing
the microservice.
- **`config`** (**required**, `string`) - The configuration file used to start
the microservice.

### `entrypoint`

The Platformatic Runtime's entrypoint is a microservice that is exposed
publicly. This value must be the ID of a service defined via the `autoload` or
`services` configuration.

### `hotReload`

An optional boolean, defaulting to `false`, indicating if hot reloading should
be enabled for the runtime. If this value is set to `false`, it will disable
hot reloading for any microservices managed by the runtime. If this value is
`true`, hot reloading for individual microservices is managed by the
configuration of that microservice.

:::warning
While hot reloading is useful for development, it is not recommended for use in
production.
:::

### `allowCycles`

An optional boolean, defaulting to `false`, indicating if dependency cycles
are allowed between microservices managed by the runtime. When the Platformatic
Runtime parses the provided configuration, it examines the clients of each
microservice, as well as the services of Platformatic Composer applications to
build a dependency graph. A topological sort is performed on this dependency
graph so that each service is started after all of its dependencies have been
started. If there are cycles, the topological sort fails and the Runtime does
not start any applications.

If `allowCycles` is `true`, the topological sort is skipped, and the
microservices are started in the order specified in the configuration file.

### `env`

An optional object used to specify the environment variables used by the
Runtime. All keys and values of the object are expected to be strings. If a
custon environment is not provided, `process.env` is used by default.

## Environment variable placeholders

The value for any configuration setting can be replaced with an environment
variable by adding a placeholder in the configuration file, for example
`{PLT_ENTRYPOINT}`.

All placeholders in a configuration must be available as an environment
variable and must meet the
[allowed placeholder name](#allowed-placeholder-names) rules.

### Setting environment variables

If a `.env` file exists it will automatically be loaded by Platformatic using
[`dotenv`](https://github.com/motdotla/dotenv). For example:

```plaintext title=".env"
PLT_ENTRYPOINT=service
```

The `.env` file must be located in the same folder as the Platformatic
configuration file or in the current working directory.

Environment variables can also be set directly on the commmand line, for example:

```bash
PLT_ENTRYPOINT=service npx platformatic runtime
```

### Allowed placeholder names

Only placeholder names prefixed with `PLT_`, or that are in this allow list,
will be dynamically replaced in the configuration file:

- `PORT`
- `DATABASE_URL`

This restriction is to avoid accidentally exposing system environment variables.
An error will be raised by Platformatic if it finds a configuration placeholder
that isn't allowed.

The default allow list can be extended by passing a `--allow-env` CLI option
with a comma separated list of strings, for example:

```bash
npx platformatic runtime --allow-env=HOST,SERVER_LOGGER_LEVEL
```

If `--allow-env` is passed as an option to the CLI, it will be merged with the
default allow list.

## Interservice communication

The Platformatic Runtime allows multiple microservice applications to run
within a single process. Only the entrypoint binds to an operating system
port and can be reached from outside of the runtime.

Within the runtime, all interservice communication happens by injecting HTTP
requests into the running servers, without binding them to ports. This injection
is handled by
[`fastify-undici-dispatcher`](https://www.npmjs.com/package/fastify-undici-dispatcher).

Each microservice is assigned an internal domain name based on its unique ID.
For example, a microservice with the ID `awesome` is given the internal domain
of `http://awesome.plt.local`. The `fastify-undici-dispatcher` module maps that
domain to the Fastify server running the `awesome` microservice. Any Node.js
APIs based on Undici, such as `fetch()`, will then automatically route requests
addressed to `awesome.plt.local` to the corresponding Fastify server.
