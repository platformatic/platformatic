# Platformatic

## Running and Developing DB

### Preparation

1. Clone this repository
2. Install pnpm `npm i pnpm --location=global`
3. Install dependencies for root project: `pnpm i`
4. Install docker with Docker Desktop or [Colima](https://github.com/abiosoft/colima)

The CLI package is now available at **./node_modules/.bin/platformatic**. Use
`pnpm link` to use `platformatic` everywhere.
```sh
(cd packages/cli && pnpm link --global)
```

<a id='run-docker'></a>
### Start the RDBMS

We use Docker to start all the databases we develop against.

On Linux, execute: `docker compose up`

On Intel Macs: `docker compose -f docker-compose-mac.yml up` 

On Apple Silicon Macs: `docker compose -f docker-compose-apple-silicon.yml up` 

### Start platformatic db

Read thorough documentation on the [quick start guide](https://github.com/platformatic/platformatic/blob/main/docs/getting-started/quick-start-guide.md), or
follow these steps to quickly create and start a platformatic db:

1. Create directories to work from `mkdir -p my-demo` then `cd my-demo`
2. Then create a package.json file with the default configs: `npm init --yes`
3. Create a migrations directory to store your database migration files: `mkdir migrations`
   Then create a new migration file named 001.do.sql in the migrations directory: `touch migrations/001.do.sql`
   Copy and paste this SQL query into the migration file:
   ```sql
   CREATE TABLE pages (
    id INTEGER PRIMARY KEY,
    title VARCHAR(255) NOT NULL
   )
   ```
4. In your project directory, create a new Platformatic configuration file named platformatic.db.json: `touch platformatic.db.json`
   Copy and paste this configuration:
   ```json
   {
     "server": {
       "hostname": "127.0.0.1",
       "port": "3042"
     },
     "core": {
       "connectionString": "sqlite://./pages.db"
     },
     "migrations": {
       "dir": "./migrations",
       "autoApply": true
     }
   }
   ```
5. In your project directory, use the Platformatic CLI to start your API server: `platformatic db start`
6. Start interacting with the API by opening the following link on your browser http://127.0.0.1:3042/documentation/static/index.html or you can use curl
   to do it. Read the quick start guide to see examples.

### Run dashboard development server

Create a `./packages/db-dashboard/.env` file with the following content
```
VITE_SERVER_URL=http://localhost:3042
```
Or whatever port you are running platformatic DB server on. 

Use the command 
```sh
pnpm run dashboard:start
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
1. Run `pnpm run dashboard:build` 
1. Run tests: `pnpm test`

### Releasing

All platformatic modules share the same release number and are released
in a single process. In order to avoid internal breakages, dependencies as
part of this repository are using the `workspace:*` which will be replaced
by precise versions during publish by pnpm.

The procedure to release is simple:

1. Update the version of the root `package.json`
1. run `./scripts/sync-version.sh`
1. run `pnpm -r publish --access=public`

### Creating and merging a PR 
On the top of the PR description, if this is a fix of a github issue, add:
```
fixes #issuenum 
```
When all checks are passed and the changes are approved, merge the PR with `squash and merge` option