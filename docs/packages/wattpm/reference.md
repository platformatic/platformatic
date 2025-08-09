import Issues from '../../getting-started/issues.md';

# Watt Commands

## `create`, `init` or `add`

Creates a new Watt project or add services to an existing project.

This is executed via the [`create-wattpm`] module.

Arguments:

- `-c, --config <config>`: Name of the configuration file to use (the default is `watt.json`)
- `-s, --skip-dependencies`: Do not install dependencies after creating the files
- `-m, --marketplace <url>`: Platformatic Marketplace host (the default is `https://marketplace.platformatic.dev`)
- `-P, --package-manager <executable>`: Use an alternative package manager (the default is `npm`)
- `-M, --module <name>`: An additional module (or a comma separated list of modules) to use as service generator (it can be used multiple times)

## `build`

Builds all services of an application.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)

## `dev`

Starts an application in development mode.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)

## `start`

Starts an application in production mode.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)
- `-i, --inspect`: Start the inspector

## `stop`

Stops a running application.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)

## `restart`

Restarts all services of a running application.

This command will pickup changes in the services (including configuration files) but not the main Watt configuration file.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)

## `reload`

Reloads a running application.

This command will pickup any changes in application directory.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)

## `ps`

Lists all running applications.

## `services`

Lists all services of a running application.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)

## `env`

Show the environment variables of a running application or one of its services.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)
- `service`: The service name

Options:

- `-t, --table`: Show variables in tabular way

## `config`

Show the configuration of a running application or one of its services.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)
- `service`: The service name

## `logs`

Streams logs from a running application or service.

If service is not specified, the command will stream logs from all services.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)
- `service`: The service name

## `inject`

Injects a request to a running application.

The command sends a request to the runtime service and prints the
response to the standard output. If the service is not specified the
request is sent to the runtime entrypoint.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)
- `service`: The service name (the default is the entrypoint)

Options:

- `-m, --method <value>`: The request method (the default is `GET`)
- `-p, --path <value>`: The request path (the default is `/`)
- `-H, --header <value>`: The request header (it can be used multiple times)
- `-d, --data <value>`: The request body
- `-D, --data-file <path>`: Read the request body from the specified file
- `-o, --output <path>`: Write the response to the specified file
- `-f, --full-output`: Include the response headers in the output (the default is false)

## `metrics`

Return metrics from a running application.

If process id is not specified, the command will return metrics from main application running.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)

Options:

- `-f, --format <"text" | "json">`: The metrics format, it should be either text or json (the default is json)

## `admin`

Start [watt-admin](https://github.com/platformatic/watt-admin), the Watt administration interface.
This is started via [`npx`](https://docs.npmjs.com/cli/v11/commands/npx).

Arguments:

- `latest`: use the latest released version of watt-admin.
- `-P, --package-manager <executable>`: Use an alternative package manager (the default is to autodetect it)

## `help`

Show help about Watt or one of its commands.

Arguments:

- `command`: The command which show the help of (if omitted, it will list all Watt commands)

## `version`

Show current Watt version.

<Issues />
