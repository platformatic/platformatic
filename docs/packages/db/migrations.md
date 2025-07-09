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

Postgrator maintains a table in your database schema to store and track which migrations have been applied. This ensures that only new or unapplied migrations run when the server starts or when manually triggered.

### Applying Migrations

You can rollback or apply migrations to a specific version using the Platformatic [CLI](../platformatic/cli.md):

```bash
$ platformatic db migrations apply --to 002
```

This command will execute rollback migrations starting from `004.undo.sql` to `003.undo.sql`. It will execute `003.do.sql` and `004.do.sql` when the server restarts if you keep these files in the migrations directory and `autoApply` is set to true in the config file. You can also manually apply the migration by running the `db migrations apply` command. 

To roll back a single migration, use the `-r` flag:

```bash 
$ platformatic db migrations apply -r 
```

## Configuring and Running Migrations

There are two ways to run migrations in Platformatic DB. They can be processed automatically when the server starts if the `autoApply` value is true, or you can just run the `db migrations apply` command.

In both cases you have to edit your config file to tell Platformatic DB where are your migration files.


### Automatically on server start
To run migrations when Platformatic DB starts,configure the `migrations` property in your project config file.

There are two options in the `"migrations"` property
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
$ npx platformatic db migrations apply --to MIGRATION_NUMBER
```

To learn more on using the CLI for migrations, see the [CLI documentation](../platformatic/cli.md#migrations-apply). 

<Issues />
