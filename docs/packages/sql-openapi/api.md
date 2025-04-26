# API

Each table is mapped to an `entity` named after the table's name. In the following reference, we'll use some placeholders, but let's start with an example:

**Example**

Given this SQL executed against your database:

```sql
CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL
);
```

- `[PLURAL_ENTITY_NAME]` is `pages`
- `[SINGULAR_ENTITY_NAME]` is `page`
- `[PRIMARY_KEY]` is `id`
- `fields` are `id`, `title`, `body`

## GET and POST parameters

Some APIs need the `GET` method, where parameters must be defined in the URL, or `POST/PUT` methods, where parameters can be defined in the `HTTP` request payload.

## Fields

Every API can define a `fields` parameter, representing the entity fields you want to get back for each row of the table. If not specified all fields are returned.

The `fields` parameter is always sent in the query string, even for `POST`, `PUT` and `DELETE` requests, as a comma-separated value.

<a name="plural"></a>
## `GET /[PLURAL_ENTITY_NAME]`

Returns all entities matching `where` clause

### Where Clause

You can define many `WHERE` clauses in REST API, each clause includes a **field**, an **operator** and a **value**.

- **Field**: One of the fields found in the schema.
- **Operator** follows this table:

| Platformatic operator | SQL operator |
|--- | ---|
| eq | `'='` |
| in | `'IN'` |
| nin | `'NOT IN'` |
| neq | `'<>'` |
| gt | `'>'` |
| gte | `'>='` |
| lt | `'<'` |
| lte | `'<='` |

- **Value**: The value you want to compare the field to.

For GET requests all these clauses are specified in the query string using the format `where.[FIELD].[OPERATOR]=[VALUE]`

**Example**

To get the `title` and the `body` of every `page` where `id < 15`, make an HTTP request like this:

```bash
$ curl -X 'GET' \
  'http://localhost:3042/pages/?fields=body,title&where.id.lt=15' \
  -H 'accept: application/json'
```

### Combining Where Clauses 

Where clause operations are by default combined with the `AND` operator. To create an `OR` condition, use the `where.or` query parameter.

Each `where.or` query parameter can contain multiple conditions separated by a `|` (pipe).

**Example**

To get the `posts` where `counter = 10` `OR` `counter > 30`, make an HTTP request like this:

```bash
$ curl -X 'GET' \
  'http://localhost:3042/pages/?where.or=(counter.eq=10|counter.gte=30)' \
  -H 'accept: application/json'
```
## OrderBy clause

You can define the ordering of the returned rows within your REST API calls with the `orderby` clause using the following pattern:

`?orderby.[field]=[asc | desc]`

- **Field**: One of the fields found in the schema.
- **Value**: can be `asc` or `desc`.

**Example**

To get the `pages` ordered alphabetically by their `titles`, make an HTTP request like this:

```bash
$ curl -X 'GET' \
  'http://localhost:3042/pages?orderby.title=asc' \
  -H 'accept: application/json'
```

### Total Count

If `totalCount` boolean is `true` in query, the GET returns the total number of elements in the `X-Total-Count` header ignoring `limit` and `offset` (if specified).

```bash
$ curl -v -X 'GET' \
  'http://localhost:3042/pages/?limit=2&offset=0&totalCount=true' \
  -H 'accept: application/json'

 (...)
> HTTP/1.1 200 OK
> x-total-count: 18
 (...)

[{"id":1,"title":"Movie1"},{"id":2,"title":"Movie2"}]%
```


## `POST [PLURAL_ENTITY_NAME]`

Creates a new row in table. Expects fields to be sent in a JSON formatted request body.

**Example**

```bash
$ curl -X 'POST' \
  'http://localhost:3042/pages/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "title": "Hello World",
  "body": "Welcome to Platformatic!"
}'

{
  "id": 1,
  "title": "Hello World",
  "body": "Welcome to Platformatic"
}
```

## `GET [PLURAL_ENTITY_NAME]/[PRIMARY_KEY]`

Returns a single row, identified by `PRIMARY_KEY`.

**Example**

```bash
$ curl -X 'GET' 'http://localhost:3042/pages/1?fields=title,body

{
  "title": "Hello World",
  "body": "Welcome to Platformatic"
}
```

## `POST [PLURAL_ENTITY_NAME]/[PRIMARY_KEY]`

Updates a row identified by `PRIMARY_KEY`. 

**Example**

```bash
$ curl -X 'POST' \
  'http://localhost:3042/pages/1' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "title": "Hello Platformatic!",
  "body": "Welcome to Platformatic!"
}'

{
  "id": 1,
  "title": "Hello Platformatic!",
  "body": "Welcome to Platformatic"
}
```

## `PUT [PLURAL_ENTITY_NAME]/[PRIMARY_KEY]`

Same as `POST [PLURAL_ENTITY_NAME]/[PRIMARY_KEY]`.

<a name="put-plural"></a>
## `PUT [PLURAL_ENTITY_NAME]`

Updates all entities matching the `where` clause

**Example**

```bash
$ curl -X 'PUT' \
  'http://localhost:3042/pages?where.id.in=1,2' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "title": "Updated title!",
  "body": "Updated body!"
}'

[{
  "id": 1,
  "title": "Updated title!",
  "body": "Updated body!"
},{
  "id": 2,
  "title": "Updated title!",
  "body": "Updated body!"
}]
```

## `DELETE [PLURAL_ENTITY_NAME]/[PRIMARY_KEY]`

Deletes a row identified by the `PRIMARY_KEY`.

**Example**

```bash
$ curl -X 'DELETE' 'http://localhost:3042/pages/1?fields=title'

{
  "title": "Hello Platformatic!"
}
```

## Nested Relationships

Let's consider the following SQL:

```sql
CREATE TABLE IF NOT EXISTS movies (
  movie_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY,
  quote TEXT NOT NULL,
  movie_id INTEGER NOT NULL REFERENCES movies(movie_id)
);
```

- `[P_PARENT_ENTITY]` is `movies`
- `[S_PARENT_ENTITY]` is `movie`
- `[P_CHILDREN_ENTITY]` is `quotes`
- `[S_CHILDREN_ENTITY]` is `quote`

In this case, more APIs are available:

### `GET [P_PARENT_ENTITY]/[PARENT_PRIMARY_KEY]/[P_CHILDREN_ENTITY]`

Given a 1-to-many relationship, where a parent entity can have many children, you can query for the children directly.

**Example**

```bash
$ curl -X 'GET' 'http://localhost:3042/movies/1/quotes?fields=quote

[
  {
    "quote": "I'll be back"
  },
  {
    "quote": "Hasta la vista, baby"
  }
]
```

### `GET [P_CHILDREN_ENTITY]/[CHILDREN_PRIMARY_KEY]/[S_PARENT_ENTITY]`

You can query for the parent directly, e.g.:

```bash
$ curl -X 'GET' 'http://localhost:3042/quotes/1/movie?fields=title

{
  "title": "Terminator"
}
```

## Many-to-Many Relationships

Many-to-Many relationships let you relate each row in one table to many rows in
another table and vice versa. 

Many-to-many relationships are implemented in SQL via a "**join table**", a table whose **primary key**
is composed by the identifier of the two parts of the many-to-many relationship.

Platformatic DB fully support many-to-many relationships on all supported database.

Let's consider the following SQL:

```sql
CREATE TABLE pages (
  id INTEGER PRIMARY KEY,
  the_title VARCHAR(42)
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username VARCHAR(255) NOT NULL
);

CREATE TABLE editors (
  page_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role VARCHAR(255) NOT NULL,
  CONSTRAINT fk_editor_pages FOREIGN KEY (page_id) REFERENCES pages(id),
  CONSTRAINT fk_editor_users FOREIGN KEY (user_id) REFERENCES users(id),
  PRIMARY KEY (page_id, user_id)
);
```

- `[P_ENTITY]` is `editors`
- `[P_REL_1]` is `pages`
- `[S_REL_1]` is `page`
- `[KEY_REL_1]` is `pages` PRIMARY KEY: `pages(id)`
- `[P_REL_2]` is `users`
- `[S_REL_2]` is `user`
- `[KEY_REL_2]` is `users` PRIMARY KEY: `users(id)`

### Available APIs for the Join Table

### `GET [P_ENTITY]/[S_REL_1]/[KEY_REL_1]/[S_REL_2]/[KEY_REL_2]`

This returns the entity in the "join table", e.g. `GET /editors/page/1/user/1`.

### `POST [P_ENTITY]/[S_REL_1]/[KEY_REL_1]/[S_REL_2]/[KEY_REL_2]`

Creates a new entity in the "join table", e.g. `POST /editors/page/1/user/1`.

### `PUT [P_ENTITY]/[S_REL_1]/[KEY_REL_1]/[S_REL_2]/[KEY_REL_2]`

Updates an entity in the "join table", e.g. `PUT /editors/page/1/user/1`.

### `DELETE [P_ENTITY]/[S_REL_1]/[KEY_REL_1]/[S_REL_2]/[KEY_REL_2]`

Delete the entity in the "join table", e.g. `DELETE /editors/page/1/user/1`.

## `GET /[P_ENTITY]`

See the [above](#plural).

*Offset* only accepts values `>= 0`. Otherwise, an error is returned.

## Pagination

Platformatic DB supports two methods of pagination for navigating through large datasets:

1. **Offset-based pagination** - using `limit` and `offset` parameters
2. **Cursor-based pagination** - using `startAfter` and `endBefore` parameters

### Offset-based Pagination

**Example**
```bash
$ curl -X 'GET' 'http://localhost:3042/movies?limit=5&offset=10

[
  {
    "title": "Star Wars",
    "movie_id": 10
  },
  ...
  {
    "title": "007",
    "movie_id": 14
  }
]
```

This returns 5 movies starting from position 10. The [TotalCount](#total-count) functionality can be used in order to evaluate if there are more pages.

### Limit

By default, a *limit* value (`10`) is applied to each request. Clients can override this behavior by passing a value. In this case the server validates the input, and an error is return if exceeds the `max` accepted value (`100`).

Limit's values can be customized through configuration:

```json
{
  ...
  "db": {
    ...
    "limit": {
      "default": 50,
      "max": 1000
    }
  }
}
```

*Limit* only accepts values `>= 0`. Otherwise, an error is returned.


### Offset

By default, *offset* is not applied to the request.
Clients can override this behavior by passing a value.

*Offset* only accepts values `>= 0`. Otherwise, an error is returned.

### Cursor-based pagination

Platformatic DB supports cursor-based pagination as an alternative to offset pagination.

When using cursor pagination, server returns opaque cursor tokens that clients can use to navigate through result set.

To enable cursor pagination, add `cursor=true` to your query:

```bash
$ curl -X 'GET' 'http://localhost:3042/movies?limit=5&cursor=true&orderby.id=asc'

[
  {
    "title": "Terminator",
    "id": 1
  },
  ...
  {
    "title": "Star Trek",
    "id": 5
  }
]
```

When cursor pagination is enabled response includes two headers:
- `x-start-after`: points to the last item in the current page
- `x-end-before`: points to the first item in the current page

To get the next page, use `startAfter` parameter with value from `x-start-after` header:
```bash
$ curl -X 'GET' 'http://localhost:3042/movies?limit=5&startAfter=eyJpZCI6NX0=&orderby.id=asc'

[
  {
    "title": "Star Wars",
    "id": 6
  },
  ...
]
```

To get the previous page, use `endBefore` parameter with value from `x-end-before` header:
```bash
$ curl -X 'GET' 'http://localhost:3042/movies?limit=5&endBefore=eyJpZCI6MX0=&orderby.id=asc'

[
  ...
]
```

Cursor pagination works with all other query parameters like `where` clauses:
```bash
$ curl -X 'GET' 'http://localhost:3042/movies?limit=3&cursor=true&where.title.like=Star%&orderby.id=asc'
```

**Compound Cursors**

For multiple ordering fields, you can create a compound cursor by including multiple fields in `orderby` clause:
```bash
$ curl -X 'GET' 'http://localhost:3042/movies?limit=5&cursor=true&orderby.createdAt=desc&orderby.id=asc'
```
This ensures consistent pagination when the first ordering field contains duplicate values.

**Requirements:**
- When using cursor pagination, the primary key (e.g., `id`) **must** be included in the `orderby` clause
- If both `startAfter` and `endBefore` provided in the same request, `startAfter` will be used by default
- Cursor values are base64-encoded and should be treated as opaque tokens
- Cursor values are generated directly from fields specified in `orderby` clause
- The order of fields in `orderby` clause is significant; usually you want to place the primary key (e.g., `id`) last in compound ordering to serve as a tie-breaker:
```bash
$ curl -X 'GET' 'http://localhost:3042/movies?limit=5&cursor=true&orderby.releaseDate=desc&orderby.id=asc'
```


## Allow the primary keys in the input

`@platformatic/sql-openapi` allows for specifying if to accept the table primary keys
in the inputs to the various routes.

### Configuration 

```js
app.register(require('@platformatic/sql-openapi'), {
  allowPrimaryKeysInInput: false
})
```
**Example**

If `allowPrimaryKeysInInput` is set to `false`:

```bash
$ curl -X 'POST' \
  'http://localhost:3042/pages/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "id": 42,
  "title": "Hello Platformatic!",
  "body": "Welcome to Platformatic!"
}'

{
  "id": 1,
  "title": "Hello Platformatic!",
  "body": "Welcome to Platformatic"
  "statusCode": 400,
  "code": 'FST_ERR_VALIDATION',
  "error:" 'Bad Request',
  "message": 'body/id must NOT be valid'
}
```

If `allowPrimaryKeysInInput` is set to `true` or left `undefined`:

```bash
$ curl -X 'POST' \
  'http://localhost:3042/pages/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "id": 42,
  "title": "Hello Platformatic!",
  "body": "Welcome to Platformatic!"
}'

{
  "id": 42,
  "title": "Hello Platformatic!",
  "body": "Welcome to Platformatic"
}
```
