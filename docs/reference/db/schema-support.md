import Issues from '../../getting-started/issues.md';

# Schema support

You can specify the database schemas to organize tables and other database objects, Platformatic DB will create entities using these schemas. 


## Example Configuration 

Consider a database setup with two schemas, each containing a different set of tables:

```sql 
CREATE SCHEMA IF NOT EXISTS "test1";
CREATE TABLE IF NOT EXISTS test1.movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);

CREATE SCHEMA IF NOT EXISTS "test2";
CREATE TABLE IF NOT EXISTS test2.users (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
```
:::info
Note that if we use schemas and migrations, we must specify the schema in the migrations table as well 
(with postgresql, we assume we use the default `public` schema).
:::

### Configuring Schemas

To utilize multiple schemas, you must specify them in the `schema` section of the configuration file as follows:

```json
  ...
  "db": {
    "connectionString": "(...)",
    "schema": [
      "test1", "test2"
    ],
    "ignore": {
      "versions": true
    }
  },
  "migrations": {
    "dir": "migrations",
    "table": "test1.versions"
  },

  ...
```

- `schema`: An array specifying which schemas Platformatic DB should inspect to create entities.
- `ignore`: Here, "`versions`": `true` specifies to ignore version tracking tables from entity generation.

## Entity Naming 

The entity names are then generated in the form `schemaName + entityName`, PascalCase (this is necessary to avoid name collisions in case there are tables with same name in different schemas).
So for instance for the example above we generate the `Test1Movie` and `Test2User` entities.

**Entity Names and Authorization**: When using schemas, it's important to refer to entities by their full generated names (e.g., `Test1Movies`) when setting up authorization rules.

:::info
**When using schemas, it's important to refer to entities by their full generated names (e.g., `Test1Movies`) when setting up authorization rules.**
:::

<Issues />
