# Many To Many Relationship

Many-to-Many relationship lets you relate each row in one table to many rows in
another table and vice versa. 

Many-to-many relationship are implemented in SQL via a "join table", a table whose **primary key**
is composed by the identifier of the two parts of the many-to-many relationship.

Platformatic DB fully support many-to-many relationships on all supported databases.

## Example

Consider the following schema (SQLite):

```SQL
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

The table `editors` is a "join table" between users and pages.
Given this schema, you could issue queries like:

```graphql
query {
  editors(orderBy: { field: role, direction: DESC }) {
    user {
      id
      username
    }
    page {
      id
      theTitle
    }
    role
  }
}
```

Mutation works exactly the same as before:

```graphql
mutation {
  saveEditor(input: { userId: "1", pageId: "1", role: "captain" }) {
    user {
      id
      username
    }
    page {
      id
      theTitle
    }
    role
  }
}
```
