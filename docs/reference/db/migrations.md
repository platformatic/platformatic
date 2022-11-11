# Migrations

Platformatic DB is already set up to run migrations for you when it starts. 
It uses [Postgrator](https://www.npmjs.com/package/postgrator) under the hood to run migrations. Please refer to the [Postgrator documentation](https://github.com/rickbergfalk/postgrator) for guidance on writing migration files.

In brief, you should create a file structure like this

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

Postgrator uses a table in your schema, to store which migrations have been already processed, so that only new ones will be applied at every server start.

You can always rollback some migrations specifing what version you would like to rollback to.

_Example_

```bash
$ platformatic db migrate --to 002
```

Will execute `004.undo.sql`, `003.undo.sql` in this order. If you keep those files in migrations directory, when the server restarts it will execute `003.do.sql` and `004.do.sql` in this order.

It's also possible to rollback a single migration with `-r`:   

```bash
$ platformatic db migrate -r 
```

## How to run migrations

There are two ways to run migrations in Platformatic DB. They can be processed automatically when the server starts, or you can just run the `db migrate` command.

In both cases you have to edit your config file to tell Platformatic DB where are your migration files.


### Automatically on server start
To run migrations when Platformatic DB starts, you need to use the config file root property `migrations`.

There are two options in the `"migrations"` property
- `dir` (_required_) the directory where the migration files are located. It will be relative to the config file path.
- `autoApply` a boolean value that tells Platformatic DB to auto-apply migrations or not (default: `false`)

_Example_

```json
{
  ...
  "migrations": {
    "dir": "./path/to/migrations/folder",
    "autoApply": false
  }
}
```


### Manually with the CLI

See documentation about `db migrate` running `npx platformatic help db migrate`.

In short:
- be sure to define a correct `migrations.dir` folder under the config on `platformatic.db.json`
- get the `MIGRATION_NUMBER` (f.e. if the file is named `002.do.sql` will be `002`)
- run `npx platformatic db migrate --to MIGRATION_NUMBER` 
