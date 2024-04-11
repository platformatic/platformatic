---
title: Overview
label: Welcome to Platformatic
---

# Welcome to Platformatic

Welcome to the Platformatic documentation. Platformatic is an open-source platform designed to simplify backend development by providing tools to quickly build and deploy APIs with GraphQL, REST, and SQL capabilities. It enhances productivity through features like auto-generated schemas, a built-in authorization system, and easy integration with existing databases and frontend frameworks

## Why Choose Platformatic?

Historically, API developers have had to repetitively build infrastructure to satisfy foundational requirements, like authentication, authorization, caching, and connection to databases, and have had to manage microservices with technologies such as service mesh or centralized registries. This work is time consuming, undifferentiated, and painstakingly complex. With growing demands of SaaS applications, the amount of API permutations has grown exponentially and has become a development bottleneck. This has led large organizations to create dedicated platform API engineering teams to help teams deliver on business demands.

Our goal is to make API development simple: we aim is to remove all friction from the day-to-day of backend developers. 

Platformatic is a collection of Open Source tools designed to eliminate friction
in backend development. 

<CardSection
  id="essentials"
  description=""
  HeadingTag="h2"
>
  <Card
    icon={<span className="text-3xl" style={{fontFamily: 'Inter'}}>1️⃣</span>}
    title="Get your keys"
    to="./get-started"
    description="Learn how to register on Dyte and get your API Keys"
  />
  <Card
    icon={<span className="text-3xl" style={{fontFamily: 'Inter'}}>2️⃣</span>}
    title="Concepts"
    to="./concepts"
    description="Learn about the architecture, design and basic concepts behind Dyte"
  />
  <Card
    icon={<span className="text-3xl" style={{fontFamily: 'Inter'}}>3️⃣</span>}
    title="Server Setup"
    to="./build-live-video-app"
    description="Steps to access Dyte's REST API"
  />
  <Card
    icon={<span className="text-3xl" style={{fontFamily: 'Inter'}}>4️⃣</span>}
    title="Client Setup"
    to="./client-setup"
    description="Set up and configure your client to integrate video calls "
  />
</CardSection>

<head>
  <title>Overview Guide</title>
  <meta
    name="description"
    content="Get started with Dyte's video conferencing capabilities. Follow our guide for an introduction to video conferencing and its features."
  />
</head>







The base services are:
- [Welcome to Platformatic](#welcome-to-platformatic)
  - [Why Choose Platformatic?](#why-choose-platformatic)
  - [Platformatic Service](#platformatic-service)
  - [Platformatic DB](#platformatic-db)
  - [Platformatic Composer](#platformatic-composer)
  - [Platformatic Runtime](#platformatic-runtime)
  - [Platformatic Stackables](#platformatic-stackables)
  - [Platformatic Cloud](#platformatic-cloud)

These micro-services can be developed and deployed independently or aggregated into a single API using [Platformatic Composer](#platformatic-composer) or deployed as a single unit using [Platformatic Runtime](#platformatic-runtime).

All platformatic components can be reused with [Stackables](#platformatic-stackables).
And finally, all Platformatic components can be deployed on [Platformatic Cloud](#platformatic-cloud).


## Platformatic Service

A Platformatic Service is an HTTP server based on [Fastify](https://www.fastify.io/) that allows developers to build robust APIs with Node.js.
With Platformatic Service you can:
- Add custom functionality in a [Fastify plugin](https://fastify.dev/docs/latest/Reference/Plugins)
- Write plugins in JavaScript or [TypeScript](https://www.typescriptlang.org/)
- Optionally use TypeScript to write your application code

A Platformatic Service is the basic building block of a Platformatic application.


## Platformatic DB

Platformatic DB can expose a SQL database by dynamically mapping it to REST/OpenAPI
and GraphQL endpoints. It supports a limited subset of the SQL query language, but
also allows developers to add their own custom routes and resolvers.

<!-- ![Platformatic DB Architecture](./platformatic-db-architecture.png) -->
a
Platformatic DB is composed of a few key libraries:

1. `@platformatic/sql-mapper` - follows the [Data Mapper pattern](https://en.wikipedia.org/wiki/Data_mapper_pattern) to build an API on top of a SQL database.
   Internally it uses the [`@database` project](https://www.atdatabases.org/).
1. `@platformatic/sql-openapi` - uses `sql-mapper` to create a series of REST routes and matching OpenAPI definitions.
   Internally it uses [`@fastify/swagger`](https://github.com/fastify/fastify-swagger).
1. `@platformatic/sql-graphql` - uses `sql-mapper` to create a GraphQL endpoint and schema. `sql-graphql` also support Federation.
   Internally it uses [`mercurius`](https://github.com/mercurius-js/mercurius).

Platformatic DB allows you to load a [Fastify plugin](https://www.fastify.io/docs/latest/Reference/Plugins/) during server startup that contains your own application-specific code.
The plugin can add more routes or resolvers — these will automatically be shown in the OpenAPI and GraphQL schemas.

SQL database migrations are also supported. They're implemented internally with the [`postgrator`](https://www.npmjs.com/package/postgrator) library.


## Platformatic Composer

Platformatic Composer is an HTTP server that automatically aggregates multiple services APIs into a single API.

<!-- ![Platformatic Composer Architecture](./platformatic-composer-architecture.png) -->

The composer acts as a proxy for the underlying services, and automatically generates an OpenAPI definition that combines all the services' routes, acting as reverse proxy for the composed services. 

## Platformatic Runtime 

Platformatic Runtime is an environment for running multiple Platformatic microservices as a single monolithic deployment unit.

<!-- ![Platformatic Runtime Architecture](./platformatic-runtime-architecture.png) -->

In a Platformatic Runtime, each service is a separate process that communicates with Interservice communication using private message passing.
The Runtime exposes an "entrypoint" API for the whole runtime. Only the entrypoint binds to an operating system port and can be reached from outside of the runtime.

## Platformatic Stackables 

Platformatic Stackables are reusable components that can be used to build Platformatic Services. Services can extends these modules and add custom functionalities.

<!-- ![Platformatic Stackables](./platformatic-stackables-architecture.png) -->

This is useful to publish the application on the public npm registry (or a private one!), including building your own CLI, or to create a specialized template for your organization to allow for centralized bugfixes and updates.

## Platformatic Cloud 
[Platformatic Cloud](https://platformatic.cloud) allows to deploy Platformatic Applications on our cloud for both static deployments and PR reviews. 
The deployment on the cloud can be done:
- Automatically using the GitHub actions created with `create-platformatic` 
- Using the Platformatic CLI (see https://docs.platformatic.dev/docs/reference/cli#deploy)

If you configure the GitHub actions, you can deploy your application on the cloud by simply pushing to the main branch or creating a PR. For a guide about how to do a deploy on Platformatic Cloud, please check the [Platformatic Cloud Quick Start Guide](https://docs.platformatic.dev/docs/platformatic-cloud/quick-start-guide).


:::info
If you create a PR, we calculate automatically the "risk score" for that PR. For more info about this, 
see [Calculate the risk of a pull request](https://docs.platformatic.dev/docs/platformatic-cloud/quick-start-guide/#calculate-the-risk-of-a-pull-request).
:::


