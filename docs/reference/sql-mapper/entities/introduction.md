# Introduction to Entities

The primary goal of Platformatic DB is to read a database schema and generate REST and GraphQL endpoints that enable the execution of CRUD (Create/Retrieve/Update/Delete) operations against the database.

Platformatic DB includes a _mapper_ that reads the schemas of database tables and then generates an _entity_ object for each table.

Platformatic DB is a [Fastify](https://fastify.io) application. The Fastify instance object is decorated with the `platformatic` property, which exposes several APIs that handle the manipulation of data in the database.

Platformatic DB populates the `app.platformatic.entities` object with data found in database tables.

The keys on the `entities` object are _singularized_ versions of the table names — for example `users` becomes `user`, `categories` becomes `category` — and the values are a set of associated metadata and functions.
