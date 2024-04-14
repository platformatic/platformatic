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
- `camelcase`: The _camelcased_ value of the field

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
