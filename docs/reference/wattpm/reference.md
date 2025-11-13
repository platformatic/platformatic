import Issues from '../../getting-started/issues.md';

# Watt Utils Commands

## `create`, `init` or `add`

Creates a new Watt project or add applications to an existing project.

This is executed via the [`create-wattpm`] module.

Arguments:

- `-c, --config <config>`: Name of the configuration file to use (the default is `watt.json`)
- `-s, --skip-dependencies`: Do not install dependencies after creating the files
- `-P, --package-manager <executable>`: Use an alternative package manager (the default is `npm`)
- `-M, --module <name>`: An additional module (or a comma separated list of modules) to use as application generator (it can be used multiple times)

## `build`

Builds all applications of an application.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)

## `install`

Install all dependencies of an application and its applications.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)
- `-p, --production`: Only install production dependencies
- `-P, --package-manager <executable>`: Use an alternative package manager (the default is to autodetect it)

## `update`

Updates all the Platformatic runtime and capability packages in your `package.json` files to the latest available version.

It will only work on packages whose are defined with the `~` or `^` syntax.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)
- `-f, --force`: Force dependencies update even if it violates the package.json version range

## `dev`

Starts an application in development mode.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)
- `-e, --env <path>`: Path to a custom .env file to load environment variables from

## `start`

Starts an application in production mode.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)
- `-e, --env <path>`: Path to a custom .env file to load environment variables from
- `-i, --inspect`: Start the inspector

## `stop`

Stops a running application.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)

## `restart`

Restarts all applications of a running application.

This command will pickup changes in the applications (including configuration files) but not the main Watt configuration file.

All applications are restarted in parallel, and within each application, workers are replaced one at a time.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)

## `reload`

Reloads a running application.

This command will pickup any changes in application directory.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)

## `ps`

Lists all running applications.

## `applications`

Lists all applications of a running application.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)

## `env`

Show the environment variables of a running application or one of its applications.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)
- `application`: The application name

Options:

- `-t, --table`: Show variables in tabular way

## `config`

Show the configuration of a running application or one of its applications.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)
- `application`: The application name

## `logs`

Streams logs from a running application or application.

If application is not specified, the command will stream logs from all applications.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)
- `application`: The application name

## `inject`

Injects a request to a running application.

The command sends a request to the runtime application and prints the
response to the standard output. If the application is not specified the
request is sent to the runtime entrypoint.

Arguments:

- `id`: The process ID or the name of the application (it can be omitted only if there is a single application running)
- `application`: The application name (the default is the entrypoint)

Options:

- `-m, --method <value>`: The request method (the default is `GET`)
- `-p, --path <value>`: The request path (the default is `/`)
- `-H, --header <value>`: The request header (it can be used multiple times)
- `-d, --data <value>`: The request body
- `-D, --data-file <path>`: Read the request body from the specified file
- `-o, --output <path>`: Write the response to the specified file
- `-f, --full-output`: Include the response headers in the output (the default is false)

## `import`

Imports an external resource as an application.

The command will insert a new application in the `watt.json`.

The external resource can be a local folder or a URL. If it is a local folder, then Watt will try to resolve Git remotes to also populate the URL.

When using URL, the resource can be later downloaded using `wattpm-utils resolve`.

If it is invoked without arguments, the command will try to fix all missing Platformatic dependencies in all local applications.

Arguments:

- `root`: The directory containing the application (the default is the current directory)
- `url`: The URL to import (can be in the form `$USER/$REPOSITORY` for GitHub repositories)

Options:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)
- `-i, --id <value>`: The id of the application (the default is the basename of the URL)
- `-p, --path <value>`: The path where to import the application (the default is the application id)
- `-H, --http`: Use HTTP URL when expanding GitHub repositories
- `-b, --branch <branch>`: The branch to clone (the default is `main`)
- `-s, --skip-dependencies`: Do not install applications dependencies. This is only used when invoked without arguments.
- `-P, --package-manager <executable>`: Use an alternative package manager (the default is to autodetect it). This is only used when invoked without arguments.

## `resolve`

Resolves all external applications. The command operates on all applications which have the `url` fields defined and the path specified as environment variable.

After cloning the application, the resolve command will set the relative path to the application in the `.env` file.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)
- `-u, --username <value>`: The username to use for HTTP URLs
- `-p, --password <value>`: The password to use for HTTP URLs
- `-s, --skip-dependencies`: Do not install applications dependencies
- `-P, --package-manager <executable>`: Use an alternative package manager (the default is to autodetect it)

## `patch-config`

Applies a patch file to the runtime and applications configurations.

Arguments:

- `-c, --config <config>`: Name of the configuration file to use (the default is to autodetect it)
- `root`: The directory containing the application (the default is the current directory)
- `patch`: The file containing the patch to execute. Its default export should be a function that receives the `runtime` and `applications` arguments and returns an object containing
  the `runtime` and `applications` keys with [JSON Patch](https://jsonpatch.com/) formatted patch to apply to configuration files.

## `help`

Show help about Watt or one of its commands.

Arguments:

- `command`: The command which show the help of (if omitted, it will list all Watt commands)

## `admin`

Start [watt-admin](https://github.com/platformatic/watt-admin), the Watt administration interface.
This is started via [`npx`](https://docs.npmjs.com/cli/v11/commands/npx).

Arguments:

- `latest`: use the latest released version of watt-admin.
- `-P, --package-manager <executable>`: Use an alternative package manager (the default is to autodetect it)

## `version`

Show current Watt version.

<Issues />
