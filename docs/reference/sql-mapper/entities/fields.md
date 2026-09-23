# Fields

When Platformatic DB inspects a database's schema, it creates an object for each table that contains a mapping of their fields.

These objects contain the following properties:
- `singularName`: singular entity name, based on table name. Uses [inflected](https://www.npmjs.com/package/inflected) under the hood.
- `pluralName`: plural entity name (i.e `'pages'`)
- `primaryKey`: the field which is identified as primary key.
- `table`: original table name
- `fields`: an object containing all fields details. Object key is the field name.
- `camelCasedFields`: an object containing all fields details in camelcase. If you have a column named `user_id` you can access it using both `userId` or `user_id`

## Fields detail

- `sqlType`: The original field type. It may vary depending on the underlying DB Engine
- `isNullable`: Whether the field can be `null` or not
- `primaryKey`: Whether the field is the primary key or not
- `foreignKey`: Whether the field is a foreign key or not
- `stringifyOutput`: Whether the field is exposed as a string in the mapper output, the JSON schemas and the generated types
- `camelcase`: The _camel cased_ value of the field

## Key types on the wire

By default primary keys are exposed as strings whatever their SQL type, and the foreign keys referencing them follow, so that comparing the two stays type-stable. A `serial`/`int4` key is therefore returned as `"1"` rather than `1`.

Set `usePrimaryKeySqlType: true` in the `db` section of the configuration to derive the exposed type of every column from its own SQL type instead. Keys are then no longer special-cased: an `int4` key is returned as `1`, while types that cannot be represented as a JSON number without losing precision (`bigint`, `int8`, `numeric`, `decimal`) stay strings.

Two things only line up with the option enabled:

- the request and response schemas of a route agree, so a value read from a response can be sent straight back
- a database view and the table behind it expose the same column with the same type, since views carry no primary key or constraint to special-case

The option defaults to `false` because turning it on changes the type of every integer key on the wire and in the generated types.

## Example
Given this SQL Schema (for PostgreSQL):
```SQL
CREATE SEQUENCE IF NOT EXISTS pages_id_seq;
CREATE TABLE "public"."pages" (
    "id" int4 NOT NULL DEFAULT nextval('pages_id_seq'::regclass),
    "title" varchar,
    "body_content" text,
    "category_id" int4,
    PRIMARY KEY ("id")
);
```

The resulting mapping object will be:

```js
{
  singularName: 'page',
  pluralName: 'pages',
  primaryKey: 'id',
  table: 'pages',
  fields: {
    id: {
      sqlType: 'int4',
      isNullable: false,
      primaryKey: true,
      camelcase: 'id'
    },
    title: {
      sqlType: 'varchar',
      isNullable: true,
      camelcase: 'title'
    },
    body_content: {
      sqlType: 'text',
      isNullable: true,
      camelcase: 'bodyContent'
    },
    category_id: {
      sqlType: 'int4',
      isNullable: true,
      foreignKey: true,
      camelcase: 'categoryId'
    }
  }
  camelCasedFields: {
    id: {
      sqlType: 'int4',
      isNullable: false,
      primaryKey: true,
      camelcase: 'id'
    },
    title: {
      sqlType: 'varchar',
      isNullable: true,
      camelcase: 'title'
    },
    bodyContent: {
      sqlType: 'text',
      isNullable: true,
      camelcase: 'bodyContent'
    },
    categoryId: {
      sqlType: 'int4',
      isNullable: true,
      foreignKey: true,
      camelcase: 'categoryId'
    }
  },
  relations: []
}
```
