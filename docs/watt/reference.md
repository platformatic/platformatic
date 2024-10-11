import Issues from '../getting-started/issues.md';

# Watt Commands

## `init`

Creates a new Watt application.

Arguments:

- `root`: The directory where to create the application (the default is the current directory)
- `entrypoint`: The name of the entrypoint service

## `build`

Builds all services of an application.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

## `dev`

Starts an application in development mode.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

## `start`

Starts an application in production mode.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

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
- `-h, --header <value>`: The request header (it can be used multiple times)
- `-d, --data <value>`: The request body
- `-D, --data-file <path>`: Read the request body from the specified file
- `-o, --output <path>`: Write the response to the specified file
- `-f, --full-output`: Include the response headers in the output (the default is false)

## `import`

Imports an external resource as a service.

The command will insert a new service in the `watt.json`.

The external resource can be a local folder or a URL. If it is a local folder, then Watt will try to resolve Git remotes to also populate the URL.

When using URL, the resource can be later downloaded using `wattpm resolve`.

If it is invoked without arguments, the command will try to fix all missing Platformatic dependencies in all local services.

Arguments:

- `root`: The directory containing the application (the default is the current directory)
- `url`: The URL to import (can be in the form `$USER/$REPOSITORY` for GitHub repositories)

Options:

- `-i, --id <value>`: The id of the service (the default is the basename of the URL)
- `-p, --path <value>`: The path where to import the service (the default is the service id)
- `-h, --http`: Use HTTP URL when expanding GitHub repositories

## `resolve`

Resolves all external services. The command operates on all services which have the `url` fields defined.

To change the directory where a service is cloned, you can set the `path` property in the service configuration.

After cloning the service, the resolve command will set the relative path to the service in the wattpm configuration file.

Arguments:

- `root`: The directory containing the application (the default is the current directory)

Options:

- `-u, --username <value>`: The username to use for HTTP URLs
- `-p, --password <value>`: The password to use for HTTP URLs
- `-s, --skip-dependencies`: Do not install services dependencies

## `help`

Show help about Watt or one of its commands.

Arguments:

- `command`: The command which show the help of (if omitted, it will list all Watt commands)

## `version`

Show current Watt version.

<Issues />
