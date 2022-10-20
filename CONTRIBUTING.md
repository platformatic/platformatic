# Platformatic

## Running and Developing DB

### Preparation

1. Clone this repository
1. Install pnpm `npm i pnpm --location=global`
2. Install dependencies for root project: `pnpm i`
4. Install docker with Docker Desktop or [Colima](https://github.com/abiosoft/colima)

<a id='run-docker'></a>
### Start the RDBMS

We use Docker to start all the databases we develop against.

On Linux, execute: `docker compose up`

On Intel Macs: `docker compose up -f docker-compose-mac.yml` 

On Apple Silicon Macs: `docker compose up -f docker-compose-apple-silicon.yml` 

### Start platformatic db

Create directories to work from:

```sh
mkdir -p my-demo/migrations
```

Install all dependencies:
```sh
pnpm i 
```

The CLI package is now available at **./node_modules/.bin/platformatic**. Use
`pnpm link` to use `platformatic` everywhere.
```sh
(cd packages/cli && pnpm link --global)
```

### Run dashboard development server

Use the command 
```sh
npm run dashboard:start
```

This will start a webpack server on port `3000` by default, with watcher and hot-reload (as a standard `create-react-app` application).

Note that GraphiQL will _not_ work because platformatic-db has not been started
yet.

### Run platformatic-db service

First build the dashboard for production with the command
```sh
pnpm run dashboard:build
```

This will create compressed files and assets under **packages/dashboard/build** directory.
To run the service:
```sh
platformatic db
```
This will load config from local directory (i.e using config file **platformatic.db.json**).

If you want to use another config file use the option `--config=/path/to/some.json`.

### Testing

1. [Run docker](#run-docker)
1. Run `npm run dashboard:build` 
1. Run tests: `npm test`

### Releasing

All platformatic modules share the same release number and are released
in a single process. In order to avoid internal breakages, dependencies as
part of this repository are using the `workspace:*` which will be replaced
by precise versions during publish by pnpm.

The procedure to release is simple:

1. Update the version of the root `package.json`
1. run `./scripts/sync-version.sh`
1. run `pnpm -r publish`

### Creating and merging a PR 
On the top of the PR description, if this is a fix of a github issue, add:
```
fixes #issuenum 
```
When all checks are passed and the changes are approved, merge the PR with `squash and merge` option
