# Platformatic

## Running and Developing DB

### Introduction 

Welcome to the Platformatic development guide. This document will help you set up your development environment, run the [Platformatic DB](https://docs.platformatic.dev/docs/db/overview), and contribute to the project. Follow the steps below to get started.

### Preparation

1. **Clone the repository**: Clone this repository and navigate to the platformatic directory.

```sh
git clone https://github.com/platformatic/platformatic.git
cd platformatic
```

2. **Install pnpm**: Install pnpm: Follow the official [pnpm installation guide](https://pnpm.io/installation) to install pnpm globally on your machine.

3. **Setup pnpm**: Run the setup script to configure the local path and restart your terminal.

```sh
pnpm setup 
```

4. **Install dependencies**: Install the dependencies for platformatic.

```sh
pnpm install 
```

5. **Install Docker**: Install Docker using [Docker desktop](https://www.docker.com/products/docker-desktop) or [Colima](https://github.com/abiosoft/colima)

6. **Run Docker Compose**: Depending on your system, use the appropriate Docker Compose file to set up your environment.

- On Intel Macs:

```sh 
docker compose -f docker-compose-mac.yml up
```

- On Apple Silicon Macs:

```sh 
docker compose -f docker-compose-apple-silicon.yml up
```

- On Windows:

```sh 
docker-compose up 
```

## Link Platformatic Globally 

To ensure your global installation of `platformatic` and `wattpm` resolve to your local copy, add a script in the root project to handle linking. This will allow you to use `platformatic` and `plt` commands globally.

From the root folder of the project, run:

```sh
pnpm run global-links
```

You might receive a `pnpm` warning, but everything should be set up correctly. Verify by running:

```sh
platformatic 
wattpm
```

## Running Platformatic locally 

To create a new Platformatic app using your local version, follow these steps:

1. **Link Platformatic and create-platformatic Globally**:
From the root folder of the project, run:

```sh
pnpm run global-links
```

2. **Create a new directory for your app**:

```sh
mkdir platformatic-app
cd platformatic-app
```

3. **Initialize a new Platformatic app using the create-platformatic** command:

```sh 
npx create-platformatic
```

4. **Follow the prompts** to configure your new app. You'll be asked to provide some information like the project name and template. Choose the options that best suit your needs

5. **Navigate into your newly created app's directory**:

```sh 
cd platformatic-app
```

6. **Run the Platformatic app** to verify everything is set up correctly:

```sh 
platformatic start
```

You should see output indicating that your Platformatic app is running on `http://localhost:3042`

<details>
  <summary><b>Troubleshooting</b></summary>

### SQLite module CPU arch incompatibility
If you encounter errors related to the SQLite module CPU architecture, follow these steps:

1. Ensure `pnpm` was not installed with `volta`. If so, reinstall it using another method.
2. Remove the `node_modules` directory and clear the pnpm store.

```sh 
rm -rf ./node_modules
pnpm store prune
pnpm store path
rm -fr /path/from/the/above/command
```
3. Reinstall the dependencies.
   
```sh 
pnpm install
```
**env: node: No such file or directory**
If you encounter this error when using pnpm, try the following:

1. Remove the `pnpm` installation.
```sh 
which pnpm 
```
2. Ensure the correct Node.js version is in use.
3. Reinstall `pnpm` 
```sh 
npm install  -g pnpm 
```
</details>
<br>


### Starting Platformatic DB 

Refer to the [quick start guide](https://github.com/platformatic/platformatic/blo) for thorough documentation, or follow these steps to quickly create and start a [Platformatic DB](https://docs.platformatic.dev/docs/db/overview) server:

1. **Create Working Directories:**

```sh 
mkdir -p my-demo 
cd my-demo 
```

2. **Initialize a package.json**: Create a package.json file.

```sh 
npm init --yes
```

1. **Create a migrations directory**: Create a directory for your database migration files.

```sh 
mkdir migrations
touch migrations/001.do.sql
```

Add the following SQL query to `001.do.sql`:

```sql 
CREATE TABLE pages (
  id INTEGER PRIMARY KEY,
  title VARCHAR(255) NOT NULL
)
```

4. **Create Platformatic Configuration File**: Create and configure `platformatic.json`.

```sh 
touch platformatic.db.json
```

Add the following configuration:

```json 
{
  "server": {
    "hostname": "127.0.0.1",
    "port": "3042"
  },
  "db": {
    "connectionString": "sqlite://./pages.db"
  },
  "migrations": {
    "dir": "./migrations",
    "autoApply": true
  }
}
```

5. **Start API Server:** Use the Platformatic CLI to start your API server.

```sh
platformatic start
```

6.**Interact with the API**


### Testing

1. **Run Tests**: Execute tests using pnpm.

```sh 
pnpm test
```

To update schemas, run `pnpm run gen-schema` in the package directory or `pnpm run build` in the root directory.

If you encounter issues with failing tests without code changes, try:

1. Clean the environment.

```sh
pnpm cleanall
```

2. Clear `pnpm` store and reinstall packages.

```sh
pnpm store path
rm -rf /path/from/previous/command
pnpm install
```

Please ensure all tests pass before opening a pull request.

### Updating the CLI docs

The `cli.md` file is automatically generated and should not be manually edited. To update the CLI docs:

1. Update or add the text helpers
2. Generate the docs.

```sh 
node scripts/gen-cli-doc.mjs
```

### Releasing

Platformatic modules share the same release number and are released in a single process. Dependencies use `workspace:*` replaced by precise versions during publish by `pnpm`.

1. Update the version in the root `package.json`.

2. Sync the version.

```sh
./scripts/sync-version.sh
```

3. Publish the release.

```sh 
pnpm -r publish --access=public
```

### Creating and Merging a PR

When creating a pull request:

1. If it fixes a GitHub issue, add the following at the top of the PR description:

```sh 
fixes #issue number 
```

2. Ensure all checks pass and the changes are approved.
3. Merge the PR using the "squash and merge" option.

### Navigating the project via ctags

You can navigate the project using [universal ctags](https://github.com/universal-ctags/ctags). Generate a `tags` file with:

```
ctags --exclude=node_modules --exclude='**/*.test.js' --exclude='**/build' -R *
```


## Developer Contribution of Origin

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
1 Letterman Drive
Suite D4700
San Francisco, CA, 94129

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

If you want to know how to retroactively add the DCO to your commits,
check out [this guide](https://github.com/src-d/guide/blob/master/developer-community/fix-DCO.md).
