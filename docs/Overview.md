---
title: Introduction
label: Welcome to Platformatic
---

# Welcome to Platformatic

Welcome to the Platformatic documentation. Platformatic is an open-source platform that simplifies backend development by providing tools to quickly build and deploy APIs with GraphQL, REST, and SQL capabilities. 

It enhances productivity through features like auto-generated schemas, a built-in authorization system, and easy integration with existing databases and frontend frameworks

## Why Choose Platformatic?

Platformatic enables developers to efficiently develop and run APIs at scale. Historically, API developers have had to repetitively build infrastructure to satisfy foundational requirements, like authentication, authorization, caching, and connection to databases, and have had to manage microservices with technologies such as service mesh or centralized registries. 

This is time-consuming, and painstakingly complex. With growing demands of SaaS applications, the amount of API permutations has grown exponentially and has become a development bottleneck. This has led large organizations to create dedicated platform API engineering teams to help teams deliver on business demands.

At Platformatic, Our goal is to make API development simple: we aim to remove friction from the day-to-day of backend developers.


## Platformatic Service

![Platformatic Service](./images/Platformatic_Service_Diagram_(Light_Mode).png)

A Platformatic Service is an HTTP server based on [Fastify](https://www.fastify.io/) that allows developers to build robust APIs with Node.js.

With Platformatic Service you can:
- Add custom functionality in a [Fastify plugin](https://fastify.dev/docs/latest/Reference/Plugins)
- Write plugins in JavaScript or [TypeScript](https://www.typescriptlang.org/)
- Optionally use TypeScript to write your application code



## Platformatic DB

![Platformatic DB Architecture](./images/Platformatic_DB_Diagram_(Light_Mode).png)

Platformatic DB can expose an SQL database by dynamically mapping it to REST/OpenAPI
and GraphQL endpoints. It supports a limited subset of the SQL query language, but
also allows developers to add their own custom routes and resolvers.

Platformatic DB is composed of a few key libraries:

1. `@platformatic/sql-mapper` - follows the [Data Mapper pattern](https://en.wikipedia.org/wiki/Data_mapper_pattern) to build an API on top of a SQL database.
   Internally it uses the [`@database` project](https://www.atdatabases.org/).
2. `@platformatic/sql-openapi` - uses `sql-mapper` to create a series of REST routes and matching OpenAPI definitions.
   Internally it uses [`@fastify/swagger`](https://github.com/fastify/fastify-swagger).
3. `@platformatic/sql-graphql` - uses `sql-mapper` to create a GraphQL endpoint and schema. `sql-graphql` also support Federation.
   Internally it uses [`mercurius`](https://github.com/mercurius-js/mercurius).
4. SQL database migrations - uses `sql-mapper` to perform schema migrations. Internally it uses [`postgrator`](https://www.npmjs.com/package/postgrator) library.

Platformatic DB allows you to load a [Fastify plugin](https://www.fastify.io/docs/latest/Reference/Plugins/) during server startup that contains your own application-specific code.
The plugin can add more routes or resolvers — these will automatically be shown in the OpenAPI and GraphQL schemas.


## Platformatic Composer

![Platformatic Composer Architecture](./images/Platformatic_Composer_Diagram_(Light_Mode).png)

Platformatic Composer is an HTTP server that automatically aggregates multiple services APIs into a single API. 
The composer acts as a proxy for the underlying services, and automatically generates an OpenAPI definition that combines all the services' routes, acting as reverse proxy for the composed services. 

## Platformatic Runtime 

![Platformatic Runtime Architecture](./images/Platformatic_Runtime_Diagram_(Light_Mode).png)

Platformatic Runtime is an environment for running multiple Platformatic microservices as a single monolithic deployment unit.

In a Platformatic Runtime, each service is a separate process that communicates with Interservice communication using private message passing.
The Runtime exposes an "entrypoint" API for the whole runtime. Only the entrypoint binds to an operating system port and can be reached from outside the runtime.

## Platformatic Stackables 

![Platformatic Stackables Architecture](./images/Platformatic_Stackables_Diagram_(Light_Mode).png)

Platformatic Stackables are reusable components that can be used to build Platformatic Services. Services can extend these modules and add custom functionalities.

This is useful to publish the application on the public npm registry (or a private one!), including building your own CLI, or to create a specialized template for your organization to allow for centralized bugfixes and updates.

## Other Resources 

- Check out our [Blog](https://blog.platformatic.dev/) and watch tutorials on [YouTube](https://www.youtube.com/channel/UCLuqTMhiF1BHGPTLYO4M3Gw).
- Join our Community on [Discord](https://discord.gg/platformatic) for updates and share your thoughts.
- Follow us on [Twitter](https://twitter.com/platformatic).


