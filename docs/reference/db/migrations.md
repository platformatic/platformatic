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

### Timestamp versions

By default the `<application-id>:migrations:create` command (`db:migrations:create` for an application named `db`) names a new migration with the next number. When several branches add migrations in parallel from the same highest version, each of them gets the same next number, and whoever merges second has to rename.

Set `naming` to `timestamp` in the `migrations` configuration to name new migrations with the current UTC date and time instead:

```json
{
  "migrations": {
    "dir": "./migrations",
    "naming": "timestamp"
  }
}
```

```
migrations/
  |- 20260115103000.do.sql
  |- 20260115103000.undo.sql
```

Naming by the UTC second makes it rare for two branches to pick the same version. In this mode the command does not connect to the database, and it creates its files exclusively, so on a filesystem that honors exclusive creation it does not overwrite one: when a migration in the directory already has that version, it uses the next free number, which may no longer read as a date and time (`20260115103059` is followed by `20260115103060`).

This option only changes the name of new files. When migrating forward, migrations still run in version order, and only the versions above the highest applied one are selected. Three things follow:

- A pending migration with a lower version, for example one created with a sequence number before the switch, still runs before the first timestamp version as long as it is above the current version of the database.
- A timestamp says when a migration was written, not when it was merged. Say one branch creates `20260115103000` and another creates `20260116090000`, the second is merged first and a database applies it. When the first branch is merged, its migration is below the database version and has no row in the versions table: it is an [out of order migration](#out-of-order-migrations). With the default `outOfOrder: "error"` the next forward apply fails and lists it, and with `ignore` it is skipped. If both branches are merged before the database applies either migration, both run, in version order.
- The same can happen inside one checkout when the clock moves backward, or with a file that carries a version from the future, once the higher version has been applied.

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

When several branches add migrations in parallel, a migration can reach a database with a version below one that the database has already applied. Say a database has applied `001` and `003`, and `002.do.sql` arrives later from another branch. Only the versions above the highest applied one are selected, so `002.do.sql` would be skipped for as long as the database version stays above it.

The `outOfOrder` option of the `migrations` configuration controls this case:

- `error` (default): applying migrations forward, or to the version the database is already at, fails before any migration SQL runs, and the error lists the `do` files below the current database version that have no row in the versions table. A skipped migration becomes a failed deploy, whether the deploy applies migrations with the `db:migrations:apply` command or at startup with `autoApply`.
- `ignore`: the migration is skipped when migrations are applied, as it was before the option existed. The [`db:migrations:status`](#migrations-status) command shows it as out of order.

To go back to skipping such a migration:

```json
{
  "migrations": {
    "dir": "./migrations",
    "outOfOrder": "ignore"
  }
}
```

Only one migration run per database should be active at a time, including runs from different workers of the same process, and the migrations directory should not change while it runs. The check takes no migration lock of its own: without the `lock` option (see [Concurrent runs](#concurrent-runs)) another run applying migrations at the same moment can change the recorded versions between its reads or after it has finished. With `lock`, on the databases that support it, the check runs after the lock is taken.

The error only reports the files. How to resolve it depends on the state of each database that shares them, so check on every one whether the reported version is recorded and whether the changes of the migration are present.

Giving the migration a new version, by renaming its `do` and `undo` files to an unused version above the highest one recorded on any of those databases, is safe only when all of these hold:

- the version is recorded on none of them
- its changes are present on none of them
- the whole sequence in its new order still gives the intended schema and data, for the moved migration and for every migration in between, on apply and on rollback, on each of those databases and on a new one

The migration then runs as a pending one.

In every other case keep the file and reconcile the databases by hand, their schema, their data and their versions table, before applying migrations again.

The `db:seed` command also refuses to seed while a skipped `do` file remains, as it does for a pending migration. If the files on disk end below the database version, an apply without a target has nothing to run, undoes nothing and reports no out of order files: apply to the current database version, for example `--to 003`, to see them.

Versions are compared as JavaScript numbers, as Postgrator compares them, so use positive safe integers. Postgrator reserves version zero for its seed row.

A skipped `do` file is not reported during a rollback and never blocks one. A rollback still selects `undo` files by version, as it does without the option, including the `undo` file of a migration that has no row.

### Migrations status

The `$db:migrations:status` command compares the migration files with the versions recorded in the database. It runs no migration, takes no migration lock and does not create the versions table.

```bash
$ npx wattpm db:migrations:status
Database version: 5

Version  File        Status
1        001.do.sql  applied
2        002.do.sql  out of order
3        003.do.sql  applied
5                    applied, file missing
6        006.do.sql  pending
```

Each migration has one of four statuses:

- `applied`: the version is recorded in the versions table and its `do` file is in the migrations directory.
- `pending`: the `do` file is above the database version.
- `out of order`: the file is below the database version and its version is not recorded. See [Out of order migrations](#out-of-order-migrations).
- `applied, file missing`: the version is recorded and no `do` file has it. This can happen when an older build lacks a migration that a newer build applied.

The command exits with code 1 when there are migrations to apply, by the same check the `db:seed` command makes before it loads a seed: a file above the database version, or a migration out of order unless `migrations.outOfOrder` is `ignore`. A recorded version without a file is listed and does not change the exit code. The check counts every file above the database version, so an `undo` file there with no `do` file gives exit code 1 with no pending row. The command also exits with code 1 when it cannot read the status, for example when the migrations directory does not exist.

With `--json` the report is printed as JSON, with the statuses `applied`, `pending`, `out-of-order` and `missing-file`. This is the JSON of the table above:

```json
{
  "databaseVersion": 5,
  "upToDate": false,
  "migrations": [
    { "version": 1, "file": "001.do.sql", "status": "applied" },
    { "version": 2, "file": "002.do.sql", "status": "out-of-order" },
    { "version": 3, "file": "003.do.sql", "status": "applied" },
    { "version": 5, "file": null, "status": "missing-file" },
    { "version": 6, "file": "006.do.sql", "status": "pending" }
  ]
}
```

The command does not validate checksums: an SQL file changed after it was applied is reported as `applied`, and an apply forward or to the current version is the one that refuses it, when `validateChecksums` is on and the recorded checksum differs. A JS migration is imported to be listed, so the code at the top level of its module runs, with whatever that code does, and can write to standard output next to the report; its `generateSql()` is not called.

On SQLite the command opens the database file read only, on a connection of its own. A file that does not exist is not created and is reported as a database with no migration applied, also when its folder does not exist. A read only connection cannot recover a database left with a hot journal by a writer that crashed: the command then fails with SQLite's error. For a database in WAL mode SQLite may still create the `-wal` and `-shm` files next to the database when the folder is writable, and may fail to read when it is not.

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

## Concurrent runs

By default nothing stops two processes from applying migrations to the same database at the same time: several replicas of an application that start together with `autoApply`, or a deploy job that overlaps with a manual `db:migrations:apply`. Both can read the same database version and run the same files, so one of them fails or a migration runs twice.

Set `lock` to `true` to run them one after the other:

```json
{
  "migrations": {
    "dir": "./path/to/migrations/folder",
    "autoApply": true,
    "lock": true
  }
}
```

With the lock, a run takes a lock on the database before it reads the database version, and at the end attempts to close the database session that holds it: the lock is free once the server has seen that session end. A second run waits, then reads the version the first one left and goes on from there. Rollbacks take the same lock.

- Every process that applies migrations to the database must set the option. A run without it does not wait.
- There is one lock for each database, whatever the `table` and `currentSchema` settings: two applications that keep their own versions tables in one database wait for each other as well. On MySQL and MariaDB the lock is tied to the name of the database the connection is on, and the processes must reach the same server; with `lower_case_table_names` set to `2` the server preserves the case of database names and compares them without it, so one database can have several spellings and all runs on that server use the same lock. On MySQL 5.7 and on MariaDB, with `lower_case_table_names` at `0` or `1`, a database selected under its legacy `#mysql50#` name gets a lock apart from the one of its plain name.
- A run with the lock creates one more connection pool, of size one, takes the lock on its connection, sends its queries through it and, at the end, attempts to dispose of the pool. The lock is an advisory lock on PostgreSQL (`pg_try_advisory_lock`) and a named lock on MySQL and MariaDB (`GET_LOCK`). It belongs to that database session: the database frees it when the session ends, so a process that crashes does not leave it behind.
- While another session holds the lock, a run tries again after a pause of up to 100 milliseconds, for `lockTimeout` milliseconds (`0` to `2147483647`, default: `60000`), and then fails with `PLT_DB_MIGRATIONS_LOCK_TIMEOUT_ERROR` without applying anything. The time starts right before the first try and is checked after each try that found the lock taken, and a run that gets the lock on its last try goes on. With `0` a run tries once. Raise it when a single run can take longer than that. With `autoApply` the wait is part of the start of the application, so the runtime's [`startTimeout`](../runtime/configuration.md#starttimeout) (default: `30000`) and `server.pluginTimeout` (default: `60000`) have to allow for it as well.
- A migration must not release the locks of its session (`pg_advisory_unlock_all()`, `RELEASE_ALL_LOCKS()`): that would let another run start before the version is recorded. Its version is recorded on the same session right after its statements, and the next migration runs there too, so a migration that changes the selected database (`USE`) has to restore it. On PostgreSQL the same holds for the `search_path` when `currentSchema` is not set; with `currentSchema`, the `search_path` is set again before each query.
- The lock does not make a migration atomic. A process that dies after the statements of a migration ran and before its version was recorded leaves that migration to be applied again by the next run, as without the lock.
- The lock needs a connection that stays on one database session and whose locks are freed when the client disconnects. Do not turn it on behind a pooler in transaction mode (for example PgBouncer with `pool_mode = transaction`), where the queries of a run can reach different sessions. A pooler in session mode works when its reset query frees advisory locks, as PgBouncer's default `DISCARD ALL` does, and when it has a spare server connection for the pool of the run: waiting for one is not part of `lockTimeout`.
- SQLite has no such lock: the option logs a warning there and the run goes on without it.

<Issues />
