import Issues from '../../getting-started/issues.md';

# Migrations

Platformatic DB uses [Postgrator](https://www.npmjs.com/package/postgrator) to handle database migrations efficiently.

:::note
For detailed guidance on writing migration files, please refer to the [Postgrator documentation](https://github.com/rickbergfalk/postgrator).
:::

## Migration File Structure

Create your migration files using the file structure below:

```
migrations/
  |- 001.do.sql
  |- 001.undo.sql
  |- 002.do.sql
  |- 002.undo.sql
  |- 003.do.sql
  |- 003.undo.sql
  |- 004.do.sql
  |- 004.undo.sql
  |- ... and so on
```

Each migration file should have a corresponding undo file to facilitate rollbacks.

## Managing Migrations

Postgrator maintains a table in your database schema to store and track which migrations have been applied. When migrating forward, only the migrations above the highest applied version run, whether the server starts or the command is triggered manually. See [Out of order migrations](#out-of-order-migrations) for a migration that arrives below that version.

### Applying Migrations

You can rollback or apply migrations to a specific version using the the Watt's `$db:migrations:apply` command (where `$db` is the id of your Platformatic DB application):

```bash
$ npx wattpm db:migrations:apply --to 002
```

This command will execute rollback migrations starting from `004.undo.sql` to `003.undo.sql`. It will execute `003.do.sql` and `004.do.sql` when the server restarts if you keep these files in the migrations directory and `autoApply` is set to true in the config file. You can also manually apply the migration by running the `db migrations apply` command.

To roll back a single migration, use the `-r` flag:

```bash
$ npx wattpm db:migrations:apply -r
```

### Out of order migrations

When several branches add migrations in parallel, a migration can reach a database with a version below one that the database has already applied. Say a database has applied `001` and `003`, and `002.do.sql` arrives later from another branch. By default `002.do.sql` is skipped for as long as the database version stays above it, because only the versions above the highest applied one are selected, and no error or warning reports it.

The `outOfOrder` option of the `migrations` configuration controls this case:

- `ignore` (default): the migration is skipped.
- `error`: applying migrations forward, or to the version the database is already at, fails before any migration SQL runs, and the error lists the `do` files below the current database version that have no row in the versions table. Use it to turn a skipped migration into a failed deploy, whether the deploy applies migrations with the `db:migrations:apply` command or at startup with `autoApply`.

```json
{
  "migrations": {
    "dir": "./migrations",
    "outOfOrder": "error"
  }
}
```

Only one migration run per database should be active at a time, including runs from different workers of the same process, and the migrations directory should not change while it runs. The check takes no migration lock: another run applying migrations at the same moment can change the recorded versions between its reads or after it has finished.

The error only reports the files. How to resolve it depends on the state of each database that shares them, so check on every one whether the reported version is recorded and whether the changes of the migration are present.

Giving the migration a new version, by renaming its `do` and `undo` files to an unused version above the highest one recorded on any of those databases, is safe only when all of these hold:

- the version is recorded on none of them
- its changes are present on none of them
- the whole sequence in its new order still gives the intended schema and data, for the moved migration and for every migration in between, on apply and on rollback, on each of those databases and on a new one

The migration then runs as a pending one.

In every other case keep the file and reconcile the databases by hand, their schema, their data and their versions table, before applying migrations with `error` again.

With `error`, the `db:seed` command also refuses to seed while a skipped `do` file remains, as it does for a pending migration. If the files on disk end below the database version, an apply without a target has nothing to run, undoes nothing and reports no out of order files: apply to the current database version, for example `--to 003`, to see them.

Versions are compared as JavaScript numbers, as Postgrator compares them, so use positive safe integers. Postgrator reserves version zero for its seed row.

A skipped `do` file is not reported during a rollback and never blocks one. A rollback still selects `undo` files by version, as it does without the option, including the `undo` file of a migration that has no row.

## Configuring and Running Migrations

There are two ways to run migrations in Platformatic DB. They can be processed automatically when the server starts if the `autoApply` value is true, or you can just run the `db migrations apply` command.

In both cases you have to edit your config file to tell Platformatic DB where are your migration files.

### Automatically on server start

To run migrations when Platformatic DB starts,configure the `migrations` property in your project config file.

This example uses two options of the `"migrations"` property

- `dir` (_required_) the directory where the migration files are located. It will be relative to the config file path.
- `autoApply` a boolean value that tells Platformatic DB to auto-apply migrations or not (default: `false`)

_Example_

```json
{
  ...
  "migrations": {
    "dir": "./path/to/migrations/folder", // Required: Path to the migration files
    "autoApply": true // Optional: Set to true to apply migrations automatically
  }
}
```

### Manually with the CLI

For manual migration management:

- Define a correct `migrations.dir` folder under the config on `platformatic.json`.
- Identify the migration number from the file name (e.g., `002` for `002.do.sql` migration file).
- Execute the migration using the command:

```bash
$ npx wattpm db:migrations:apply --to MIGRATION_NUMBER
```

<Issues />
